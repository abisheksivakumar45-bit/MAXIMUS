# MAXIMUS — Implementation Status

Last verified: **2026-10-18** · Phase: **2 — Authentication & Profile**
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

## 2. Implemented and verified

### Phase 1 — Foundation

| Area | Status | Evidence |
| --- | --- | --- |
| FastAPI backend with app factory, layered modules | ✅ Verified | Boots in Docker; serves HTTP |
| PostgreSQL 16 via Compose, named volume | ✅ Verified | `db` healthy; data survives `down` + `up` |
| Alembic migrations (baseline `0001`, `users`) | ✅ Verified | `alembic current` → `0001`; table + indexes inspected in `psql` |
| Health endpoints | ✅ Verified | `/`, `/api/health`, `/api/health/live`, `/api/health/ready` all return expected bodies/status |
| Readiness failure handling | ✅ Verified | With `db` stopped, `/api/health/ready` → **503**; `/api/health/live` stays **200**; recovers to **200** after `db` restarts |
| Strict CORS from configuration | ✅ Verified | Allow-list only; credentials enabled for the session cookie |
| Safe error handling (no stack traces to clients) | ✅ Implemented | Global handler returns generic message; traceback logged server-side |
| React + TypeScript (strict) + Vite + Tailwind v4 + React Router shell | ✅ Verified | `tsc --noEmit`, production build, container serves HTML + module |
| Typed API service layer + `useApiResource` states | ✅ Verified | Unit tests exercise success, error, and empty states |
| Responsive UI shell (desktop sidebar / mobile drawer) | ✅ Implemented | Rendered markup; `prefers-reduced-motion` honoured; semantic nav + `aria` attributes |
| Dashboard with **real** service/database status | ✅ Verified | Fetches live endpoints; no hardcoded data |
| Settings page with real environment/DB status + honest AI state | ✅ Implemented | AI shown as "Not configured" |
| Honest "not implemented" + 404 pages | ✅ Implemented | Every planned route resolves to a real, labelled page |
| Docker Compose stack with healthchecks + dependency ordering | ✅ Verified | `db` → `backend` (healthy) → `frontend` |
| Documentation set | ✅ Written | `README.md`, `docs/*` |
| Backend tests | ✅ 10 passed | `pytest` (see §4) — Phase 1 baseline |
| Frontend tests | ✅ 5 passed | `vitest run` — Phase 1 baseline |
| Lint / format / typecheck / audit | ✅ Clean | `ruff check`, `ruff format --check`, `tsc`, `npm audit` (0 vulns) |

### Phase 2 — Authentication & Profile

| Area | Status | Evidence |
| --- | --- | --- |
| Registration (`POST /api/auth/register`) | ✅ Verified | 201 + session cookie; duplicate → 409; invalid input → 422 |
| Login (`POST /api/auth/login`) | ✅ Verified | 200 + session cookie; wrong password **and** unknown email both → generic 401 |
| Logout (`POST /api/auth/logout`) | ✅ Verified | 200; session revoked server-side; subsequent `/me` → 401 |
| Auth state restoration (`GET /api/auth/me`) | ✅ Verified | 200 when the session cookie is valid; 401 otherwise |
| Server-managed opaque sessions | ✅ Verified | Random token in `HttpOnly` cookie; only an HMAC-SHA256 hash stored in `auth_sessions` |
| Password hashing (Argon2id) | ✅ Verified | `argon2-cffi`; DB stores `$argon2id$…`; `0` rows contain the plaintext |
| Session expiry + sliding renewal | ✅ Verified | `expires_at` enforced; `last_used_at` refreshed on use |
| CSRF protection (double-submit) | ✅ Verified | Safe request sets `maximus_csrf`; state-changing request without the header → **403** |
| Rate limiting on auth endpoints | ✅ Verified | 10 attempts per window, then **429** `"Too many attempts…"` |
| Profile retrieval (`GET /api/profile`) | ✅ Verified | 200 with own profile only; 401 when unauthenticated |
| Profile update (`PATCH /api/profile`) | ✅ Verified | 200 updates display name; email is read-only; requires CSRF |
| Per-user data isolation | ✅ Verified | Identity always derived from the session, never from client input |
| `SECRET_KEY` mandatory at startup | ✅ Verified | Backend refuses to start when missing / shorter than 32 chars |
| Migration `0002` (`auth_sessions`) | ✅ Verified | Applied to live PostgreSQL; FK `ON DELETE CASCADE`; reversible |
| Protected + public-only routes (frontend) | ✅ Verified | Guards redirect; `AuthProvider` restores state on load |
| Login / Register / Profile pages | ✅ Verified | Accessible forms, password visibility toggle, disabled submits, error alerts |
| Backend tests | ✅ 43 passed | `pytest` (see §4) |
| Frontend tests | ✅ 32 passed | `vitest run` — 8 files |
| Lint / format / typecheck / build / audit | ✅ Clean | `ruff check`, `ruff format --check`, `tsc`, `vite build`, `npm audit` (0 vulns) |

---

## 3. Not implemented (honestly unavailable)

The following are **not** built and are labelled as such in the UI. They belong
to later phases per the master specification: goals & onboarding (3), roadmap
engine & AI provider (4), weekly/daily planning (5), XP/levels/streaks/
achievements & analytics (6), nutrition & fitness (7), academics &
cybersecurity (8), sleep & habits (9), AI coach (10), adaptive planning (11).

There is **no** mock data, **no** fake API responses, **no** invented charts,
and **no** XP or progress values anywhere. Authentication is real, but business
tables other than `users` and `auth_sessions` do not exist yet.

---

## 4. Verification log (actual commands & results)

### Backend (`backend/`)

```
..\.venv\Scripts\python.exe -m pytest
  → 43 passed, 1 warning (third-party Starlette httpx deprecation only)

..\.venv\Scripts\python.exe -m ruff check .
  → All checks passed!

..\.venv\Scripts\python.exe -m ruff format --check .
  → 41 files already formatted
```

Test inventory: health endpoints (service info, liveness without DB, readiness
200, readiness 503 on DB error), model round-trip, unique-email constraint,
schema validation, **migration upgrade/downgrade run against a real Alembic
environment**, plus the Phase 2 suites: registration (success, duplicate,
invalid, hash-not-plaintext), login/session (success, wrong credentials,
restoration, logout invalidation, unauthenticated rejection), profile
(retrieve, valid/invalid update, per-user isolation), and security (input
validation, no hash in responses, rate limiting, CSRF enforcement).

### Frontend (`frontend/`)

```
npm run typecheck   → no errors (TypeScript strict)
npm test            → Test Files 8 passed (8); Tests 32 passed (32)
npm run build       → built successfully (tsc + vite build)
npm audit           → found 0 vulnerabilities
```

Frontend test inventory: API client (method/body/CSRF header/error handling),
validation, `AuthContext` (restore/register/login/logout), route guards, the
login page, and the profile page.

### Phase 2 live verification (Docker Compose, PostgreSQL)

```
docker compose build backend frontend      → exit 0
docker compose up -d backend frontend      → exit 0; backend healthy
docker compose exec -T backend alembic current   → 0002 (head)
docker compose exec -T db psql ... -c "\d auth_sessions"
  → uuid/timestamptz/varchar(64) columns, now() default,
    unique btree(token_hash), btree(user_id), btree(expires_at),
    FK user_id → users(id) ON DELETE CASCADE

GET  /api/auth/me (anonymous)                     → 401 + Set-Cookie maximus_csrf
POST /api/auth/register (no X-CSRF-Token)         → 403 "CSRF validation failed"
POST /api/auth/register (valid)                   → 201 + HttpOnly maximus_session cookie
GET  /api/auth/me (session)                       → 200 (user only; no hash)
GET  /api/profile                                 → 200
PATCH /api/profile (with CSRF)                    → 200, display_name updated
PATCH /api/profile (no CSRF)                      → 403
POST /api/auth/logout (with CSRF)                 → 200 "Logged out"
GET  /api/auth/me (after logout)                  → 401
POST /api/auth/login (correct)                    → 200 + session cookie
POST /api/auth/login (wrong password)             → 401 "Invalid email or password."
POST /api/auth/login (unknown email)              → 401 "Invalid email or password."  (identical)
POST /api/auth/register x10 then x11              → processed, then 429 rate limited
CORS  Origin: http://localhost:5183               → access-control-allow-origin echoed, credentials true
CORS  Origin: http://evil.example.com             → no access-control-allow-origin
GET  http://localhost:5183/api/health             → 200 (Vite proxy → backend)

DB assertions:
  users.password_hash      → `$argon2id$…` (length 97); 0 rows contain the plaintext
  auth_sessions.token_hash → 64-char HMAC hash; revoked session flagged revoked_at
```

> API docs and the interactive Swagger UI are disabled when `APP_ENV=production`.

### Docker Compose (project root)

```
docker compose up --build -d       → exit code 0
docker compose ps                  → db (healthy), backend (healthy), frontend (up)
docker compose exec -T backend alembic current        → 0002 (head)
docker compose exec -T db psql ... -c "\dt"           → alembic_version, users, auth_sessions
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

## 5. Defects found and fixed during verification

- **Migration `0001` had a `SyntaxError`** (Phase 1): `sa.sql.expression.true()`
  was passed positionally after keyword arguments, so `alembic upgrade head`
  failed inside Docker. It was not caught by the earlier test run because tests
  used `Base.metadata.create_all` and ruff excluded migration files.
  - Fixed to `server_default=sa.true()`.
  - Added `app/tests/test_migrations.py`, which runs the real migrations
    (upgrade **and** downgrade) so this class of error is caught by `pytest`.
  - Removed the ruff exclusion of `alembic/versions` so migrations are linted.
- **Test isolation leak** (Phase 2): the pytest `db_session` fixture used
  `join_transaction_mode="create_savepoint"`, which caused committed rows to
  survive the per-test teardown `rollback()` on SQLite/pysqlite, so test data
  leaked between tests (and made user-isolation assertions unreliable).
  - Root cause confirmed by reproducing each `join_transaction_mode` value;
    only `create_savepoint` leaked.
  - Fixed by using the default session nesting and guarding teardown with
    `if transaction.is_active: transaction.rollback()`.
- **Test bugs** (Phase 2): UUID-vs-JSON-string comparison in `test_auth.py`
  (fixed to compare stringified UUIDs) and reading `Set-Cookie` via
  `headers.get_list("set-cookie")` in `test_security.py` (a single `get()`
  returned only one of two cookies).

---

## 6. Known limitations

- No product features beyond authentication: goals, roadmaps, planning,
  nutrition, fitness, coaching, etc. are Phase 3+ and are labelled honestly.
- No AI provider (Phase 4). The Settings page states this explicitly.
- The frontend container runs the Vite **development** server; it is not a
  hardened production static server. Code changes require a rebuild
  (`docker compose up --build`) unless services are run locally.
- `id`s have no database-level default by design (the ORM generates them), so
  raw SQL inserts must supply an id (e.g. `gen_random_uuid()`).
- Rate limiting is **in-process and per-instance** (a sliding window in memory);
  it is not shared across replicas. A shared store (e.g. Redis) is a later-phase
  concern.
- Session cookies are `Secure` only when `COOKIE_SECURE=true`; local HTTP
  development runs with `false`, which must be flipped behind HTTPS.
- Tests run on SQLite; PostgreSQL migration behaviour is verified operationally
  (§4) rather than in pytest.

---

## 7. Required environment variables

See `.env.example`. `SECRET_KEY` is now **mandatory**.

| Variable | Required now | Notes |
| --- | --- | --- |
| `SECRET_KEY` | **Yes** | Signs session tokens (HMAC). Must be ≥ 32 chars; the backend refuses to start otherwise. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `DATABASE_URL` | When running the backend on the host | Compose sets it automatically. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | No (defaults) | Dev placeholders only. |
| `BACKEND_CORS_ORIGINS` | No | Defaults to the Vite origins. |
| `SESSION_LIFETIME_DAYS` | No | Default `30`. |
| `COOKIE_SECURE` | No | Default `false`; set `true` behind HTTPS. |
| `AUTH_RATE_LIMIT_ATTEMPTS` / `AUTH_RATE_LIMIT_WINDOW_SECONDS` | No | Default `10` / `60`. |
| `APP_ENV`, `APP_VERSION`, `LOG_LEVEL` | No | Defaults provided. |
| Host ports (`POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`) | No | Change to avoid conflicts. |
| AI variables | **Phase 4** | Not used. |

---

## 8. Exact startup commands

```powershell
# From the project root (D:\projects\MAXIMUS)
Copy-Item .env.example .env      # first time only, then set a real SECRET_KEY
docker compose up --build -d
docker compose ps
Start-Process http://localhost:5173   # (or :5183 in this environment)

# Stop
docker compose down              # keeps data
docker compose down -v           # DELETES the database volume
```

> Generate the session secret before the very first start:
> `python -c "import secrets; print(secrets.token_urlsafe(48))"` and put it in
> `.env` as `SECRET_KEY=…`.

---

## 9. Recommended next phase

**Phase 3 — Goals & onboarding** per `docs/DEVELOPMENT_PLAN.md`: the first
user-owned business data, built on the authentication and per-user access
introduced in Phase 2.
