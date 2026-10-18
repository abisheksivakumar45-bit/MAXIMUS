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

## 2. Repository layout

```
MAXIMUS/
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── main.py          create_app() factory, middleware, error handling
│   │   ├── core/            config (pydantic-settings), logging
│   │   ├── db/              declarative base, mixins, engine/session factory
│   │   ├── models/          SQLAlchemy ORM models
│   │   ├── schemas/         Pydantic request/response schemas
│   │   ├── api/routes/      HTTP routers (thin: delegate to services)
│   │   └── tests/           pytest suite (runs on SQLite, no DB required)
│   ├── alembic/             versioned migrations
│   ├── requirements*.txt    pinned dependencies
│   └── Dockerfile
├── frontend/                React + TypeScript + Vite
│   ├── src/
│   │   ├── app/             App root, router, navigation model
│   │   ├── components/      reusable UI + layout (Sidebar, Card, states)
│   │   ├── features/        one folder per product area
│   │   │   ├── dashboard/   Dashboard + real service status card
│   │   │   ├── settings/    environment/service/database/AI status
│   │   │   └── shared/      honest placeholder + 404 pages
│   │   ├── hooks/           useApiResource, useServiceHealth
│   │   ├── lib/             api client, small utils
│   │   ├── styles/          Tailwind entry + design tokens
│   │   ├── test/            Vitest setup
│   │   └── types/           typed API contracts
│   └── Dockerfile
├── docs/                    this documentation set
├── docker-compose.yml
├── .env.example
└── README.md
```

## 3. Backend architecture

- **Layering.** Routes stay thin; business logic belongs in `services/`
  (introduced with the first real business feature). Data access is
  encapsulated in ORM models and, later, repositories. AI orchestration will
  live in `ai/`, planning logic in `planning/` (both Phase 4+).
- **App factory.** `app.main.create_app()` builds the `FastAPI` instance so
  tests can construct isolated apps and override dependencies.
- **Configuration.** `app.core.config.Settings` (pydantic-settings) reads
  environment variables / `.env`. `get_settings()` is `lru_cache`d and used as
  a FastAPI dependency. Database credentials are never hardcoded.
- **Database session.** A single engine plus `sessionmaker` in
  `app.db.session`; `get_session()` is the per-request FastAPI dependency.
  `pool_pre_ping=True` guards against stale connections.
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
  base URL, timeouts (`AbortController`), and error normalisation into
  `ApiError`. Components never call `fetch` directly.
- **Async state.** `useApiResource` exposes an explicit discriminated union
  (`loading | success | error`) plus `reload`, so every consumer handles all
  states. Loading, error (with retry) and empty states are real components.
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
| `users` table created in Phase 1 | It is the ownership root every later table references; creating it now with the initial migration avoids a throwaway baseline. No auth endpoints exist yet. |
| Tests run on SQLite | Fast, isolated, no external dependency. PostgreSQL behaviour (migrations, types) is verified against the real container separately. |
| Vite dev-server `/api` proxy | Same-origin requests in development; CORS stays strict. |
| Recharts deferred to Phase 6 | No charts exist yet; avoid unused dependencies. |
| No bind mounts in Compose | Predictable, reproducible startup; hot reload is available by running services locally. |
| Frontend image is dev-only | Production static hosting/optimisation is a later-phase concern. |

## 6. Deliberate limitations (Phase 1)

- No authentication or authorization yet (Phase 2). The API exposes only
  public health endpoints, so no user data is reachable.
- No AI provider integration (Phase 4). The Settings page states this plainly.
- No business tables other than `users`.
- The frontend Docker image runs the Vite dev server, not a hardened static
  server.
