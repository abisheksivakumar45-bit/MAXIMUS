# MAXIMUS — Implementation Status

Last verified: **2026-10-16** · Phase: **1 — Foundation**
Authoritative spec: [`MASTER_SPEC.md`](./MASTER_SPEC.md)

This document records what is actually implemented and verified. Planned
features are never listed as done.

---

## 1. Environment used for verification

| Component | Version |
| --- | --- |
| Python | 3.14.4 |
| Node.js / npm | 24.19.0 / 12.0.2 |
| Docker / Compose | 29.7.2 / v5.5.1 |
| PostgreSQL | 16 (container) |
| Host | Windows 11, PowerShell |

> **Port note.** On this machine host ports `8000` and `5173` were already in use
> by an unrelated project's containers (`crimnet-*`). MAXIMUS was therefore run
> on `BACKEND_PORT=8010` and `FRONTEND_PORT=5183` via the local `.env`. The
> defaults in `.env.example` remain `8000`/`5173`. Container-internal ports are
> unchanged (`8000`, `5173`), including the Vite proxy target.

---

## 2. Implemented and verified (Phase 1)

| Area | Status | Evidence |
| --- | --- | --- |
| FastAPI backend with app factory, layered modules | ✅ Verified | Boots in Docker; serves HTTP |
| PostgreSQL 16 via Compose, named volume | ✅ Verified | `db` healthy; data survives `down` + `up` |
| Alembic migrations (baseline `0001`, `users`) | ✅ Verified | `alembic current` → `0001 (head)`; table + indexes inspected in `psql` |
| Health endpoints | ✅ Verified | `/`, `/api/health`, `/api/health/live`, `/api/health/ready` all return expected bodies/status |
| Readiness failure handling | ✅ Verified | With `db` stopped, `/api/health/ready` → **503**; `/api/health/live` stays **200**; recovers to **200** after `db` restarts |
| Strict CORS from configuration | ✅ Configured | Allow-list only; `GET` only; credentials off |
| Safe error handling (no stack traces to clients) | ✅ Implemented | Global handler returns generic message; traceback logged server-side |
| React + TypeScript (strict) + Vite + Tailwind v4 + React Router shell | ✅ Verified | `tsc --noEmit`, production build, container serves HTML + module |
| Typed API service layer + `useApiResource` states | ✅ Verified | Unit tests exercise success, error, and empty states |
| Responsive UI shell (desktop sidebar / mobile drawer) | ✅ Implemented | Rendered markup; `prefers-reduced-motion` honoured; semantic nav + `aria` attributes |
| Dashboard with **real** service/database status | ✅ Verified | Fetches live endpoints; no hardcoded data |
| Settings page with real environment/DB status + honest AI state | ✅ Implemented | AI shown as "Not configured" |
| Honest "not implemented" + 404 pages | ✅ Implemented | Every planned route resolves to a real, labelled page |
| Docker Compose stack with healthchecks + dependency ordering | ✅ Verified | `db` → `backend` (healthy) → `frontend` |
| Documentation set | ✅ Written | `README.md`, `docs/*` |
| Backend tests | ✅ 10 passed | `pytest` (see §4) |
| Frontend tests | ✅ 5 passed | `vitest run` (see §4) |
| Lint / format / typecheck / audit | ✅ Clean | `ruff check`, `ruff format --check`, `tsc`, `npm audit` (0 vulns) |

---

## 3. Not implemented (honestly unavailable)

The following are **not** built and are labelled as such in the UI. They belong
to later phases per the master specification: authentication & sessions (2),
goals & onboarding (3), roadmap engine & AI provider (4), weekly/daily planning
(5), XP/levels/streaks/achievements & analytics (6), nutrition & fitness (7),
academics & cybersecurity (8), sleep & habits (9), AI coach (10), adaptive
planning (11).

There is **no** mock data, **no** fake API responses, **no** invented charts,
and **no** XP or progress values anywhere. Business tables other than `users`
do not exist yet.

---

## 4. Verification log (actual commands & results)

### Backend (`backend/`)

```
..\.venv\Scripts\python.exe -m pytest
  → 10 passed, 1 warning (third-party Starlette httpx deprecation only)

..\.venv\Scripts\python.exe -m ruff check .
  → All checks passed!

..\.venv\Scripts\python.exe -m ruff format --check .
  → 22 files already formatted
```

Test inventory: health endpoints (service info, liveness without DB, readiness
200, readiness 503 on DB error), model round-trip, unique-email constraint,
schema validation, and **migration upgrade/downgrade run against a real Alembic
environment**.

### Frontend (`frontend/`)

```
npm run typecheck   → no errors (TypeScript strict)
npm test            → Test Files 2 passed (2); Tests 5 passed (5)
npm run build       → built successfully (tsc + vite build)
npm audit           → found 0 vulnerabilities
```

### Docker Compose (project root)

```
docker compose up --build -d       → exit code 0
docker compose ps                  → db (healthy), backend (healthy), frontend (up)
docker compose exec -T backend alembic current        → 0001 (head)
docker compose exec -T db psql ... -c "\dt"           → alembic_version, users
docker compose exec -T db psql ... -c "\d users"      → UUID PK, unique email index,
                                                         is_active default true,
                                                         created_at/updated_at now()
GET http://localhost:8010/api/health        → 200 {service:MAXIMUS, version:0.1.0, ...}
GET http://localhost:8010/api/health/live   → 200 {status:alive}
GET http://localhost:8010/api/health/ready  → 200 {status:ready, database.connected:true}
GET http://localhost:5183/                  → 200 HTML (<title>MAXIMUS</title>)
GET http://localhost:5183/api/health        → 200 (Vite proxy → backend)
```

Failure-path checks (live):

```
docker compose stop db  → GET /api/health/ready → 503 ; GET /api/health/live → 200
docker compose start db → GET /api/health/ready → 200 (recovered)
```

Persistence check:

```
INSERT a row → docker compose down → docker compose up -d → row still present
(server default is_active = true confirmed). Test row then deleted.
```

> Note: in PowerShell, `docker compose up -d` prints progress to **stderr**, so
> the console shows a red `NativeCommandError` even though the command exits
> **0**. This is a shell-display artifact, not a failure.

---

## 5. Defect found and fixed during verification

- **Migration `0001` had a `SyntaxError`**: `sa.sql.expression.true()` was passed
  positionally after keyword arguments, so `alembic upgrade head` failed inside
  Docker. It was not caught by the earlier test run because tests used
  `Base.metadata.create_all` and ruff excluded migration files.
  - Fixed to `server_default=sa.true()`.
  - Added `app/tests/test_migrations.py`, which runs the real migrations
    (upgrade **and** downgrade) so this class of error is caught by `pytest`.
  - Removed the ruff exclusion of `alembic/versions` so migrations are linted.

---

## 6. Known limitations

- No authentication yet (Phase 2); only public health endpoints exist.
- No AI provider (Phase 4). The Settings page states this explicitly.
- The frontend container runs the Vite **development** server; it is not a
  hardened production static server. Code changes require a rebuild
  (`docker compose up --build`) unless services are run locally.
- Only the `users` table exists; `id` is generated in Python, so raw SQL inserts
  must supply an id (e.g. `gen_random_uuid()`).
- `id` has no database-level default by design (the ORM generates it).
- Tests run on SQLite; PostgreSQL migration behaviour is verified operationally
  (§4) rather than in pytest.

---

## 7. Required environment variables

All have development defaults; see `.env.example`.

| Variable | Required now | Notes |
| --- | --- | --- |
| `DATABASE_URL` | When running the backend on the host | Compose sets it automatically. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | No (defaults) | Dev placeholders only. |
| `BACKEND_CORS_ORIGINS` | No | Defaults to the Vite origins. |
| `SECRET_KEY` | **Phase 2** | Not used yet; empty is accepted. |
| `APP_ENV`, `APP_VERSION`, `LOG_LEVEL` | No | Defaults provided. |
| Host ports (`POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`) | No | Change to avoid conflicts. |
| AI variables | **Phase 4** | Not used. |

---

## 8. Exact startup commands

```powershell
# From the project root (D:\projects\MAXIMUS)
Copy-Item .env.example .env      # first time only
docker compose up --build -d
docker compose ps
Start-Process http://localhost:5173   # (or :5183 in this environment)

# Stop
docker compose down              # keeps data
docker compose down -v           # DELETES the database volume
```

---

## 9. Recommended next phase

**Phase 2 — Authentication and profile**: registration, login, logout, secure
token sessions, protected routes, profile management, validation, and the
authentication/authorization test suite. It will make `SECRET_KEY` mandatory and
introduce user-scoped access for the first time.
