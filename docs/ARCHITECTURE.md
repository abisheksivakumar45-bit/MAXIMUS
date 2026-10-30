# MAXIMUS — Architecture

Source of truth for the product itself is [`MASTER_SPEC.md`](./MASTER_SPEC.md).
This document records how the implementation is put together and the decisions
that materially affect future development.

## 1. System overview

```
┌────────────────┐        /api/* (proxied)        ┌──────────────────┐
│  React (Vite)  │ ─────────────────────────────▶ │  FastAPI backend │
│   frontend     │ ◀───────────────────────────── │     backend      │
└────────────────┘        JSON over HTTP          └────────┬─────────┘
                                                            │ SQLAlchemy 2.x
                                                            │ (psycopg 3)
                                                            ▼
                                                   ┌──────────────────┐
                                                   │   PostgreSQL 16  │
                                                   └──────────────────┘
```

Three services, orchestrated locally by Docker Compose (`db`, `backend`,
`frontend`). In development the browser talks only to the Vite dev server,
which proxies `/api` to the backend — so no CORS is required for the normal
local flow, and the same frontend build works behind a single origin later.

Roadmap generation adds one **optional backend-only egress**: the backend may
call a configured OpenAI-compatible Chat Completions endpoint. The browser never
talks to the provider and never receives the API key. With `AI_PROVIDER=none`
(default), there is no external call at all.

## 2. Repository layout

```
MAXIMUS/
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── main.py          create_app() factory, middleware, error handling
│   │   ├── core/            config, logging, security (hashing/tokens),
│   │   │                    rate_limit, csrf
│   │   ├── db/              declarative base, mixins, engine/session factory
│   │   ├── ai/              provider protocol, OpenAI-compatible client,
│   │   │                    prompt builder, strict output schema
│   │   ├── models/          SQLAlchemy ORM models (user, session, goal, roadmap)
│   │   ├── schemas/         Pydantic request/response schemas
│   │   ├── repositories/    data access (user, session, goal, roadmap)
│   │   ├── services/        business logic (auth, goal, onboarding, roadmap)
│   │   ├── api/             deps (current user, provider) + thin routes
│   │   └── tests/           pytest suite (SQLite; AI mocked)
│   ├── alembic/             versioned migrations
│   ├── requirements*.txt    pinned dependencies
│   └── Dockerfile
├── frontend/                React + TypeScript + Vite
│   ├── src/
│   │   ├── app/             App root, router, navigation model
│   │   ├── components/      reusable UI + layout (Sidebar, Card, states)
│   │   ├── features/        one folder per product area
│   │   │   ├── auth/        AuthContext, guards, layouts, pages, validation
│   │   │   ├── dashboard/   Dashboard + real service/status cards
│   │   │   ├── goals/       category-driven goal CRUD + assessments
│   │   │   ├── onboarding/  resumable multi-step wizard
│   │   │   ├── roadmaps/    listing, generation, detail, approval
│   │   │   ├── settings/    environment/service/database/AI status
│   │   │   └── shared/      honest placeholder + 404 pages
│   │   ├── hooks/           useApiResource, useServiceHealth
│   │   ├── lib/             api client (CSRF-aware), small utils
│   │   ├── styles/          Tailwind entry + design tokens
│   │   ├── test/            Vitest setup + helpers
│   │   └── types/           typed API contracts
│   └── Dockerfile
├── docs/                    this documentation set
├── docker-compose.yml
├── .env.example
└── README.md
```

## 3. Backend architecture

- **Layering.** Routes stay thin; business logic lives in `services/`
  (`auth_service`, `goal_service`, `onboarding_service`, `roadmap_service`).
  Data access is encapsulated in `repositories/` (user, session, goal, roadmap)
  and ORM models. The AI provider sits behind `ai.provider.AIProvider`, so the
  roadmap service never imports HTTP or provider-specific types. Planning logic
  lands in `planning/` in Phase 5.
- **App factory.** `app.main.create_app()` builds the `FastAPI` instance so
  tests can construct isolated apps and override dependencies.
- **Configuration.** `app.core.config.Settings` (pydantic-settings) reads
  environment variables / `.env`. `get_settings()` is `lru_cache`d and used as
  a FastAPI dependency. `SECRET_KEY` is required and validated (≥ 32 chars) — the
  app refuses to start without it. Database credentials are never hardcoded.
- **Database session.** A single engine plus `sessionmaker` in
  `app.db.session`; `get_session()` is the per-request FastAPI dependency.
  `pool_pre_ping=True` guards against stale connections.
- **Authentication.** Opaque server-managed sessions: a random 256-bit token is
  sent in an `HttpOnly` cookie and only its HMAC-SHA256 hash is stored
  (`auth_sessions`). `api/deps.py` exposes `get_current_user`, which resolves the
  cookie → session row → user and rejects expired/revoked sessions. Passwords are
  hashed with Argon2id (`core/security.py`).
- **Middleware.** CSRF double-submit (`core/csrf.py`), credential-enabled strict
  CORS, and an in-process sliding-window rate limiter (`core/rate_limit.py`)
  wrap the app.
- **AI provider.** `ai/provider.py` defines the protocol and safe exception
  hierarchy; `ai/openai_provider.py` implements an OpenAI-compatible
  `/chat/completions` call with configurable base URL/model, connect + request
  timeouts, bounded retries, JSON mode, and strict parsing. `ai/factory.py`
  builds the provider from settings and exposes only non-sensitive status.
  `services/roadmap_service.py` owns eligibility, idempotency, prompt building,
  validation, one-transaction persistence, and approval. Provider failures are
  mapped to safe `502`/`503`/`504` responses and never leave partial rows.
- **Migrations.** Alembic owns the schema. The backend container runs
  `alembic upgrade head` before starting. `create_all()` is used **only** in
  tests, never against a real database.
- **Errors.** Unhandled exceptions are logged server-side (with traceback) and
  returned to clients as a generic `{"detail": "Internal server error"}`; stack
  traces are never exposed.
- **Health checks.** `/api/health` (info), `/api/health/live` (liveness, no
  DB) and `/api/health/ready` (readiness, `SELECT 1`, HTTP 503 on failure).

## 4. Frontend architecture

- **Stack.** React 19, TypeScript (strict), Vite, Tailwind CSS v4, React Router.
  Recharts is intentionally **not** installed yet — it arrives with the
  analytics charts (Phase 6) to avoid an unused dependency.
- **Rendering.** `App` → `BrowserRouter` → `AppRoutes`. `AppRoutes` is split out
  from the router so tests can render it under `MemoryRouter`.
- **Data layer.** All HTTP goes through `src/lib/api.ts`, which centralises the
  base URL, timeouts (`AbortController`), `credentials: 'include'`, the
  `X-CSRF-Token` header on state-changing requests, and error normalisation into
  `ApiError`. Components never call `fetch` directly. Roadmap generation uses a
  longer client timeout (180s) because it may wait on the provider; every other
  request keeps the 10s default.
- **Auth state.** `features/auth/AuthContext.tsx` is the single source of truth
  for the signed-in user. It restores state on load by calling `GET /api/auth/me`
  (which also bootstraps the CSRF cookie) and exposes `register`/`login`/`logout`.
  `ProtectedRoute` redirects anonymous users to login; `PublicOnlyRoute` keeps
  signed-in users out of the auth pages.
- **Async state.** `useApiResource` exposes an explicit discriminated union
  (`loading | success | error`) plus `reload`, so every consumer handles all
  states. Loading, error (with retry) and empty states are real components.
- **Roadmaps.** `/roadmaps` loads provider status, eligible goals, and saved
  summaries. Generation is hidden when the backend reports no provider; a
  failed attempt keeps the same idempotency key for a safe retry. The detail
  page renders only persisted milestones/tasks/resources and read-only statuses;
  approval re-fetches the server state.
- **Navigation model.** `src/app/navigation.ts` is the single source of truth
  for the sidebar and routes. Routes marked `implemented: false` render an
  honest "not implemented yet — Phase N" page. There are no dead links and no
  fake features.
- **Styling.** Tailwind v4 with design tokens defined once in
  `src/styles/index.css` (`@theme`): charcoal palette, gold accent, radii,
  fonts. `prefers-reduced-motion` is respected globally.

## 5. Key decisions

| Decision | Rationale |
| --- | --- |
| UUID primary keys | Avoids enumeration, eases future sync/multi-device work. |
| `users` table created in Phase 1 | It is the ownership root every later table references; creating it now with the initial migration avoided a throwaway baseline. Auth endpoints landed in Phase 2. |
| Opaque DB-backed sessions (not JWT) | Logout and revocation are immediate and server-authoritative; no token can outlive its row. The token never leaves the `HttpOnly` cookie. |
| Store only an HMAC hash of the session token | A database leak does not yield usable session tokens. |
| Double-submit CSRF with `SameSite=Lax` cookies | Cheap, stateless, and effective for a cookie-authenticated API without an extra double-submit store. |
| Argon2id via `argon2-cffi` | Memory-hard, current best practice; parameter tuning left at library defaults. |
| Tests run on SQLite | Fast, isolated, no external dependency. PostgreSQL behaviour (migrations, types) is verified against the real container separately. |
| OpenAI-compatible provider behind a protocol | Works with OpenAI, OpenRouter, Groq, or local runtimes without leaking vendor types into business logic; providers are swappable. |
| Strict Pydantic output with `extra="forbid"` | An LLM response is untrusted input; unknown fields, missing fields, and oversized content are rejected before persistence. |
| Idempotency key + database unique constraint | A retried request after a network error cannot create or pay for a second roadmap; the in-process guard only reduces duplicate concurrent calls. |
| Default `AI_PROVIDER=none` | The app runs fully offline; generation reports "not configured" instead of faking output or failing at startup. |
| Approval archives older plans | Preserves plan history without allowing multiple active plans per goal. |
| Vite dev-server `/api` proxy | Same-origin requests in development; cookies work without CORS complexity. |
| Recharts deferred to Phase 6 | No charts exist yet; avoid unused dependencies. |
| No bind mounts in Compose | Predictable, reproducible startup; hot reload is available by running services locally. |
| Frontend image is dev-only | Production static hosting/optimisation is a later-phase concern. |

## 6. Deliberate limitations

- Implemented so far: authentication, profile, goals, onboarding, roadmaps, and
  AI roadmap generation. Weekly/daily planning, progress tracking, XP, nutrition,
  fitness, coaching, and adaptive planning are later phases. The API exposes
  health, auth, profile, goals, onboarding, and roadmap endpoints only.
- Real AI generation requires explicit credentials. The default stack reports
  `configured: false` and returns `503` for generation; it never fabricates a
  roadmap. No real paid provider call was made during verification.
- The provider is called synchronously; there is no background job or streaming.
- Rate limiting and the duplicate-call guard are in-process and per-instance
  (not shared across replicas).
- AI output is structurally validated, not fact-checked; prompt injection is
  mitigated, not eliminated.
- Roadmap/task statuses are read-only in Phase 4; progress tracking is Phase 5.
- Daily tasks, XP, and the other later-phase tables do not exist.
- The frontend Docker image runs the Vite dev server, not a hardened static
  server.
