# MAXIMUS — Implementation Status

Last verified: **2026-10-19** · Phase: **3 — Goals & Onboarding**
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

### Phase 3 — Goals & Onboarding

| Area | Status | Evidence |
| --- | --- | --- |
| Canonical category taxonomy (`app/core/goal_categories.py`) | ✅ Verified | 8 slugs; `GET /api/goals/categories` serialises them; UI renders forms from the response (no drift possible) |
| Goal CRUD (`GET/POST /api/goals`, `GET/PATCH/DELETE /api/goals/{id}`) | ✅ Verified | Live E2E: create 201, list 200, patch 200, delete 204, deleted → 404 |
| Assessment validation per category | ✅ Verified | Unknown choice value → 422; missing required answer → 422; answers stored and returned |
| Duplicate protection (name + category per user) | ✅ Verified | Same name+category → 409; different name in same category → allowed |
| Per-user isolation | ✅ Verified | Cross-user GET/PATCH/DELETE all → 404 with the **identical** body to a missing id |
| Onboarding save/resume (`PUT /api/onboarding` partial merge) | ✅ Verified | Partial saves merge; `current_step` persists; refresh resumes at the stored step |
| Server-authoritative completion gate | ✅ Verified | Early `completed: true` → 400 `"Onboarding still needs …"`; completion only after required answers |
| Draft-goal lifecycle | ✅ Verified | Onboarding creates `draft` goals; completion activates them in the same transaction; partial saves keep them draft |
| Migration `0003` (goals, goal_assessments, user_onboarding) | ✅ Verified | Applied to live PostgreSQL; Phase 1/2 data preserved; upgrade + downgrade tested in pytest |
| Multi-step onboarding wizard | ✅ Verified | Welcome → profile → lifestyle → goals → assessment → review; progress indicator; Back/Continue; data preserved across steps |
| Client-side validation mirroring the server | ✅ Verified | Required, max-length, choice membership, 24-hour time pattern; server remains the authority |
| Goals page (create/edit/delete, status controls) | ✅ Verified | Two-step delete confirm; category locked once answered (documented limitation); quick pause/resume/complete |
| Dashboard goals summary | ✅ Verified | Active goal count, names/categories, assessment status, resume-onboarding CTA when incomplete |
| Auth redirects through onboarding | ✅ Verified | Register → `/onboarding`; login → `/onboarding` when incomplete, else requested page |
| Backend tests | ✅ 87 passed | `pytest` (see §4) — incl. a production-lifecycle regression test |
| Frontend tests | ✅ 68 passed | `vitest run` — 11 files |
| Lint / format / typecheck / build / audit | ✅ Clean | `ruff check`, `ruff format --check`, `tsc`, `vite build`, `npm audit` (0 vulns) |

---

## 3. Not implemented (honestly unavailable)

The following are **not** built and are labelled as such in the UI. They belong
to later phases per the master specification: roadmap engine & AI provider (4),
weekly/daily planning (5), XP/levels/streaks/achievements & analytics (6),
nutrition & fitness (7), academics & cybersecurity (8), sleep & habits (9), AI
coach (10), adaptive planning (11).

There is **no** mock data, **no** fake API responses, **no** invented charts,
and **no** XP or progress values anywhere. The only business tables are the
Phase 3 set (`goals`, `goal_assessments`, `user_onboarding`) plus Phase 1/2
(`users`, `auth_sessions`).

---

## 4. Verification log (actual commands & results)

### Backend (`backend/`)

```
..\.venv\Scripts\python.exe -m pytest
  → 87 passed, 1 warning (third-party Starlette httpx deprecation only)

..\.venv\Scripts\python.exe -m ruff check .
  → All checks passed!

..\.venv\Scripts\python.exe -m ruff format --check .
  → 55 files already formatted
```

Test inventory: health endpoints (service info, liveness without DB, readiness
200, readiness 503 on DB error), model round-trip, unique-email constraint,
schema validation, **migration upgrade/downgrade run against a real Alembic
environment**, the Phase 2 suites (registration, login/session, profile,
security), and the Phase 3 suites: goal categories (canonical set, public
access, required flags, text limits), goal CRUD (create with/without
assessment, list, get, patch, delete, duplicates, invalid answers),
per-user isolation (identical 404 for missing vs. other-user), onboarding
(partial merge, resume, validation, completion gate, draft activation),
and a **production-lifecycle regression test** that gives each request its
own short-lived session (see §5).

### Frontend (`frontend/`)

```
npx tsc --noEmit   → no errors (TypeScript strict)
npx vitest run     → Test Files 11 passed (11); Tests 68 passed (68)
npx vite build     → built successfully
npm audit          → found 0 vulnerabilities
```

Frontend test inventory: API client (method/body/CSRF header/error handling,
goals & onboarding namespaces), validation, `AuthContext`, route guards,
login page (incl. onboarding redirect), profile page, Sidebar, Dashboard
(goals summary, resume-onboarding CTA), Goals page (CRUD, delete confirm,
status controls, validation preservation), Onboarding wizard (resume,
validation, step navigation, data preservation, goal select/deselect,
assessment validation, completion gate, loading/error/retry, duplicate-submit
prevention), and route-level protection for `/goals` and `/onboarding`.

### Phase 3 live verification (Docker Compose, PostgreSQL)

```
docker compose config --quiet            → exit 0
docker compose up -d --build backend frontend → exit 0; backend healthy
docker compose exec backend alembic current    → 0003 (head)
docker compose exec backend alembic history    → 0001 → 0002 → 0003
psql \dt  → alembic_version, users, auth_sessions,
            goals, goal_assessments, user_onboarding
psql counts: users=4, auth_sessions=5 (Phase 1/2 dev data preserved)
GET  /api/health, /api/health/ready        → 200, database connected
GET  http://localhost:5183/{,/goals,/onboarding} → 200 (SPA fallback)
```

End-to-end journey via API (24/24 checks, throwaway accounts):

```
GET  /api/auth/me (anonymous)        → 401 + CSRF cookie issued
POST /api/auth/register              → 201 + session
GET  /api/onboarding                 → incomplete; missing: timezone,
                                       daily availability, ≥1 goal
GET  /api/goals/categories           → 8 canonical categories
PUT  /api/onboarding (partial)       → 200, merge verified
PUT  completed early                 → 400 "Onboarding still needs …"
POST /api/goals (valid assessment)   → 201, status=draft
POST /api/goals (same name+category) → 409
POST /api/goals (unknown choice)     → 422
POST /api/goals (missing required)   → 422
GET/PATCH/DELETE cross-user goal     → 404, body identical to missing id
PUT  completed (all requirements)    → 200, completed_at set
GET  /api/goals/{id}                 → status=active (drafts activated),
                                       assessment answers preserved
PATCH status                         → 200
DELETE                               → 204; then GET → 404
GET  /api/onboarding after complete  → readable + editable
```

Backend log scan for the run: no tracebacks, no 5xx; the only 404s are the
deliberate cross-user isolation probes. `.env` never printed or modified;
`docker compose down -v` never used; dev accounts left intact.

> Note: in PowerShell, `docker compose up -d` prints progress to **stderr**, so
> the console shows a red `NativeCommandError` even though the command exits
> **0**. This is a shell-display artifact, not a failure.

---

## 5. Defects found and fixed during verification

- **`create_goal` never committed its transaction** (Phase 3): the goal
  service flushed new goals but did not `commit()`, and the production session
  dependency closes (and thereby rolls back) the session at the end of every
  request. Every goal created through the API was silently discarded: the
  create returned 201, but the goal was invisible to all later requests —
  breaking duplicate detection (409 never fired), onboarding completion
  ("still needs at least one goal"), and the goals list.
  - Not caught by the existing pytest suite because its shared test session
    keeps one open transaction per test, so flushed rows stayed visible.
  - Found by an end-to-end API journey against the live Docker stack, which
    uses real per-request sessions.
  - Fixed by adding the missing `self._session.commit()` (now consistent with
    every other write path in the services).
  - Added `test_goals_and_onboarding_persist_across_request_scoped_sessions`,
    which reproduces the production lifecycle (one short-lived session per
    request, closed without commit) on an isolated engine; verified it fails
    without the fix and passes with it.
- **Onboarding wizard state clobbered mid-flow** (Phase 3): `loadInitial`'s
  callback depended on `user.display_name`, so saving the profile step (which
  updates the user) re-ran the full wizard load and discarded in-progress
  step/answers/selection while racing the save request.
  - Fixed by decoupling the load from the user object (separate one-time seed
    effect for the display name) and gating the load on the resolved auth
    status.
- **Freshly selected goal had no stored name** (Phase 3): the goals step
  displayed the category label as the default goal name but never wrote it
  into state, so Continue either errored ("Every goal needs a name.") or read
  `undefined` and crashed.
  - Fixed by seeding `goalNames[slug]` with the category label when a category
    is toggled on.
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

- No product features beyond goals/onboarding: roadmaps, planning, nutrition,
  fitness, coaching, etc. are Phase 4+ and are labelled honestly.
- No AI provider (Phase 4). The Settings page states this explicitly.
- A goal's **category cannot be changed after its assessment is answered**
  (the edit form locks the field with a hint). The stored answers belong to
  the old category's question set; the safe path is to delete the goal and
  create one in the new category. Category is editable while unanswered.
- Onboarding's lifestyle questions are saved but no phase yet acts on them
  (the roadmap engine is Phase 4); the review step shows them truthfully as
  "used to shape your roadmap when it is built".
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

**Phase 4 — Roadmap engine & AI provider** per `docs/DEVELOPMENT_PLAN.md`:
turning the goals and onboarding answers collected in Phase 3 into real
roadmaps, behind a provider interface with an honest "not configured" state.
