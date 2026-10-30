# MAXIMUS — Development Plan

The phase list below mirrors `MASTER_SPEC.md` §30. Current status is tracked
here and in [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md). A phase is
only marked complete when its completion criteria have been verified.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Project inspection and plan | ✅ Done |
| 1 | Foundation | ✅ Done |
| 2 | Authentication and profile | ✅ Done |
| 3 | Goals and onboarding | ✅ Done |
| 4 | Roadmap engine and AI provider | ✅ Done |
| 5 | Weekly and daily planning | ⏳ Next |
| 6 | XP and progress | ☐ Planned |
| 7 | Nutrition and fitness | ☐ Planned |
| 8 | Academics and cybersecurity | ☐ Planned |
| 9 | Sleep and discipline | ☐ Planned |
| 10 | AI coach | ☐ Planned |
| 11 | Adaptive planning | ☐ Planned |
| 12 | Security and quality assurance | ☐ Planned |
| 13 | Final polish | ☐ Planned |

## Phase 0 — Inspection (complete)

- Inspected the working directory; the only pre-existing file was
  `docs/MASTER_SPEC.md`, which is preserved unchanged.
- Confirmed tooling: Python 3.14, Node 24, Docker 29 + Compose v5, Git.
- Produced the architecture in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Phase 1 — Foundation (complete)

- React 19 + TypeScript (strict) + Vite + Tailwind v4 + React Router shell with
  a typed API layer, responsive navigation, real service status, honest
  placeholders, and a 404 page.
- FastAPI + SQLAlchemy 2.x + Pydantic v2 + pydantic-settings in a layered
  structure; PostgreSQL 16 in Compose with a named volume and healthchecks.
- Health endpoints, strict CORS, safe error handling, Alembic baseline `0001`,
  Docker Compose orchestration, `.env.example`, and this documentation set.

## Phase 2 — Authentication and profile (complete)

- Registration, login, logout, and session restoration with opaque
  server-managed sessions; only an HMAC-SHA256 hash of the token is stored.
- Argon2id password hashing, a generic login error, double-submit CSRF,
  auth-endpoint rate limiting, protected/public-only routes, and a display-name
  profile page.
- Migration `0002` (`auth_sessions`); mandatory validated `SECRET_KEY`.

## Phase 3 — Goals and onboarding (complete)

- Canonical goal categories with per-category assessment questions.
- Goal CRUD with duplicate protection and per-user isolation (identical `404`
  for missing and foreign records).
- Resumable multi-step onboarding with a server-authoritative completion gate;
  draft goals activate on completion.
- Migration `0003` (`goals`, `goal_assessments`, `user_onboarding`); a
  production-lifecycle regression test for request-scoped commits.

## Phase 4 — Roadmap engine and AI provider (complete)

- **Schema and migration `0004`**: `roadmaps`, `roadmap_milestones`,
  `roadmap_tasks`, and `roadmap_resources`, with ordered positions, statuses,
  provider/model provenance, and cascade ownership.
- **Provider abstraction**: an `AIProvider` protocol plus an OpenAI-compatible
  implementation using `httpx`; configurable base URL, model, connect/read
  timeouts, bounded retries, JSON mode, and output limits.
- **Strict output contract**: Pydantic models with `extra="forbid"` and bounded
  strings/lists; malformed, truncated, or oversized responses are rejected.
- **Generation service**: authenticated flow from goal + assessment + onboarding
  context to a bounded, injection-resistant prompt, provider call, validation,
  and single-transaction persistence. Provider failures leave no record.
- **Idempotency and safety**: optional idempotency keys (unique per user),
  duplicate-key conflict detection, an in-process duplicate-call guard, and a
  per-user generation rate limit.
- **API**: `GET /api/roadmaps/config`, `GET /api/roadmaps`,
  `POST /api/roadmaps/generate`, `GET /api/roadmaps/{id}`, and
  `POST /api/roadmaps/{id}/approve`, all authenticated and owner-scoped.
- **Approval**: making a roadmap active archives the previous active plan for
  the same goal instead of deleting history.
- **Frontend**: protected `/roadmaps` listing + generation panel (loading,
  honest unconfigured state, empty state, errors with safe retry) and
  `/roadmaps/:id` detail page with overview, ordered milestones, tasks,
  resources, statuses, and approval. Settings shows real provider status.
- **Configuration**: `AI_*` and `ROADMAP_RATE_LIMIT_*` added to `.env.example`
  and Compose. Default `AI_PROVIDER=none` keeps the stack fully offline and
  makes generation report that it is not configured.
- **Verification**: 130 backend tests, 83 frontend tests, lint/format/typecheck/
  build/audit clean, migration `0004` applied live, and a 32/32 live API
  journey against a local mock provider. No real paid AI call was made.

## Scope discipline

Later-phase features are **not** started before the preceding phase's criteria
are met and verified. Planned UI areas render an honest placeholder until their
phase lands. Weekly/daily planning, progress tracking, XP, nutrition, fitness,
academics, sleep, AI coaching, and adaptive planning remain unavailable and are
labelled as such.
