# MAXIMUS — Development Plan

The phase list below mirrors `MASTER_SPEC.md` §30. Current status is tracked
here and in [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md). A phase is
only marked complete when its completion criteria have been verified.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Project inspection and plan | ✅ Done |
| 1 | Foundation | ✅ Done |
| 2 | Authentication and profile | ⏳ Next |
| 3 | Goals and onboarding | ⬜ Planned |
| 4 | Roadmap engine | ⬜ Planned |
| 5 | Weekly and daily planning | ⬜ Planned |
| 6 | XP and progress | ⬜ Planned |
| 7 | Nutrition and fitness | ⬜ Planned |
| 8 | Academics and cybersecurity | ⬜ Planned |
| 9 | Sleep and discipline | ⬜ Planned |
| 10 | AI coach | ⬜ Planned |
| 11 | Adaptive planning | ⬜ Planned |
| 12 | Security and quality assurance | ⬜ Planned |
| 13 | Final polish | ⬜ Planned |

## Phase 0 — Inspection (complete)

- Inspected the working directory; the only pre-existing file was
  `docs/MASTER_SPEC.md`, which is preserved unchanged.
- Confirmed tooling: Python 3.14, Node 24, Docker 29 + Compose v5, Git.
- Produced the architecture in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Phase 1 — Foundation (complete)

Deliverables:

- **Frontend** initialised: React 19 + TypeScript (strict) + Vite + Tailwind v4
  + React Router, with a typed API service layer.
- **Backend** initialised: FastAPI + SQLAlchemy 2.x + Pydantic v2 +
  pydantic-settings, in a layered module structure.
- **PostgreSQL** configured (v16, named volume, healthcheck).
- **Docker Compose** orchestrates `db` → `backend` → `frontend` with health
  dependency handling.
- **Environment configuration**: `.env.example`, git-ignored `.env`, secrets via
  environment variables only.
- **Health endpoints**: `/api/health`, `/api/health/live`, `/api/health/ready`.
- **Database migrations**: Alembic, baseline revision `0001` creating `users`.
- **Initial UI shell**: dark-themed layout, sidebar (desktop) and drawer
  (mobile), Dashboard with real service status, Settings, honest
  "not-implemented" pages, and a 404 page.
- **Documentation**: this set plus `README.md`.

Verification (see `IMPLEMENTATION_STATUS.md` for the exact results):
backend lint + tests, frontend typecheck + tests + build, Docker Compose stack
startup, migration application, and live health-endpoint checks.

## Phase 2 — Authentication and profile (next)

Registration, login, logout, secure sessions, protected routes, profile
management, validation, and the authentication/authorization test suite.
Requires a non-empty `SECRET_KEY`.

## Scope discipline

Later-phase features are **not** started before the preceding phase's criteria
are met and verified. Planned UI areas render an honest placeholder until their
phase lands.
