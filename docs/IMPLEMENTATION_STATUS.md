# MAXIMUS — Implementation Status

Last verified: **2026-10-30** · Phase: **4 — Roadmap Engine & AI Provider**
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
> by an unrelated project's containers. MAXIMUS runs on `BACKEND_PORT=8010` and
> `FRONTEND_PORT=5183` via the local `.env`. The defaults in `.env.example`
> remain `8000`/`5173`. Container-internal ports are unchanged (`8000`, `5173`),
> including the Vite proxy target.

---

## 2. Implemented and verified

### Phase 1 — Foundation

| Area | Status | Evidence |
| --- | --- | --- |
| FastAPI backend with app factory, layered modules | ✅ Verified | Boots in Docker; serves HTTP |
| PostgreSQL 16 via Compose, named volume | ✅ Verified | `db` healthy; data survives `down` + `up` |
| Alembic migrations | ✅ Verified | `alembic current` advances to head; reversible |
| Health endpoints | ✅ Verified | `/`, `/api/health`, `/api/health/live`, `/api/health/ready` return expected bodies/status |
| Readiness failure handling | ✅ Verified | With `db` stopped, readiness → **503**; liveness stays **200** |
| Strict CORS from configuration | ✅ Verified | Allow-list only; credentials enabled for the session cookie |
| Safe error handling (no stack traces to clients) | ✅ Implemented | Global handler returns a generic message; traceback logged server-side |
| React + TypeScript (strict) + Vite + Tailwind v4 + React Router shell | ✅ Verified | `tsc --noEmit`, production build, container serves the app |
| Typed API service layer + `useApiResource` states | ✅ Verified | Unit tests exercise loading, success, error, and empty states |
| Responsive UI shell (desktop sidebar / mobile drawer) | ✅ Implemented | Semantic nav + `aria` attributes; reduced motion honoured |
| Dashboard with **real** service/database status | ✅ Verified | Fetches live endpoints; no hardcoded data |
| Settings page with real environment/DB/AI status | ✅ Verified | Values come from the backend; AI status never includes the key |
| Honest "not implemented" + 404 pages | ✅ Implemented | Every unimplemented route resolves to a labelled page |
| Docker Compose stack with healthchecks + dependency ordering | ✅ Verified | `db` → `backend` (healthy) → `frontend` |
| Documentation set | ✅ Written | `README.md`, `docs/*` |

### Phase 2 — Authentication & Profile

| Area | Status | Evidence |
| --- | --- | --- |
| Registration (`POST /api/auth/register`) | ✅ Verified | 201 + session cookie; duplicate → 409; invalid input → 422 |
| Login (`POST /api/auth/login`) | ✅ Verified | 200 + session cookie; wrong password and unknown email both → generic 401 |
| Logout (`POST /api/auth/logout`) | ✅ Verified | 200; session revoked server-side; subsequent `/me` → 401 |
| Auth state restoration (`GET /api/auth/me`) | ✅ Verified | 200 with a valid session; 401 otherwise |
| Server-managed opaque sessions | ✅ Verified | Random token in `HttpOnly` cookie; only an HMAC-SHA256 hash stored |
| Password hashing (Argon2id) | ✅ Verified | `argon2-cffi`; no plaintext stored |
| Session expiry + sliding renewal | ✅ Verified | `expires_at` enforced; `last_used_at` refreshed |
| CSRF protection (double-submit) | ✅ Verified | Missing/mismatched header → **403** |
| Auth rate limiting | ✅ Verified | Sliding window; excess → **429** |
| Profile retrieval/update | ✅ Verified | Identity derived from the session; email read-only |
| Migration `0002` (`auth_sessions`) | ✅ Verified | Applied live; FK `ON DELETE CASCADE`; reversible |
| Protected + public-only routes | ✅ Verified | Guards redirect; `AuthProvider` restores state |
| Login / Register / Profile pages | ✅ Verified | Accessible forms, validation, disabled submits, real errors |

### Phase 3 — Goals & Onboarding

| Area | Status | Evidence |
| --- | --- | --- |
| Canonical category taxonomy | ✅ Verified | 8 slugs; `GET /api/goals/categories`; UI renders forms from the response |
| Goal CRUD | ✅ Verified | Live E2E: create 201, list 200, patch 200, delete 204, deleted → 404 |
| Assessment validation per category | ✅ Verified | Unknown choice → 422; missing required → 422; answers stored/returned |
| Duplicate protection | ✅ Verified | Same name+category per user → 409 |
| Per-user isolation | ✅ Verified | Cross-user GET/PATCH/DELETE → 404 identical to a missing id |
| Onboarding save/resume | ✅ Verified | Partial saves merge; `current_step` persists; refresh resumes |
| Server-authoritative completion gate | ✅ Verified | Early `completed: true` → 400; completion only after required answers |
| Draft-goal lifecycle | ✅ Verified | Onboarding creates `draft` goals; completion activates them |
| Migration `0003` | ✅ Verified | Applied live; Phase 1/2 data preserved; upgrade + downgrade tested |
| Multi-step onboarding wizard | ✅ Verified | Resume, navigation, validation, data preservation, review |
| Goals page | ✅ Verified | Create/edit/delete, status controls, delete confirmation |
| Dashboard goals summary | ✅ Verified | Active count, names/categories, assessment status, resume CTA |
| Auth redirects through onboarding | ✅ Verified | Register/login redirect based on server state |

### Phase 4 — Roadmap Engine & AI Provider

| Area | Status | Evidence |
| --- | --- | --- |
| Schema `0004` (`roadmaps`, `roadmap_milestones`, `roadmap_tasks`, `roadmap_resources`) | ✅ Verified | Applied live (`0004 (head)`); cascade delete verified; upgrade + downgrade tested in pytest |
| Provider abstraction (`AIProvider` protocol) | ✅ Implemented | Service depends on the protocol; no OpenAI types leak into business logic |
| OpenAI-compatible provider | ✅ Implemented | `httpx` POST to `/chat/completions`; configurable base URL/model; connect + request timeouts; bounded retries |
| Honest unconfigured state | ✅ Verified | Default stack: `GET /api/roadmaps/config` → `configured: false`; generation → **503**; no fabricated roadmap |
| Strict structured output | ✅ Verified | Pydantic contract with `extra="forbid"`, bounded strings/lists; malformed/truncated output → **502** |
| Generation flow | ✅ Verified | Authenticate → owner-scoped goal → prompt → provider → validate → persist → return persisted roadmap |
| No partial records on failure | ✅ Verified | Live provider-unavailable generation returned **502**; roadmap list count unchanged |
| Idempotency | ✅ Verified | Replay → **200** same id; same key for another goal → **409**; no second provider call |
| Duplicate-call guard | ✅ Implemented | In-process guard prevents concurrent duplicate generation; database unique constraint is the durable guarantee |
| Approval | ✅ Verified | First approval → `active`; approving a newer plan archives the previous active plan for that goal; approval is idempotent |
| Per-user rate limiting on generation | ✅ Verified | `ROADMAP_RATE_LIMIT_*`; **429** when exhausted; tests isolate the limiter |
| Ownership enforcement | ✅ Verified | Cross-user read/approve → identical 404; cross-user generation → 404 `Goal not found.` |
| Prompt-injection mitigation | ✅ Verified | User context delimited as untrusted data, control characters removed, fields clipped, hard context ceiling; tests cover injection text and clipping |
| API endpoints | ✅ Implemented | `GET /config`, `GET /roadmaps`, `POST /generate`, `GET /{id}`, `POST /{id}/approve` |
| Frontend `/roadmaps` | ✅ Verified | Protected page; generation panel; provider status; loading/error/retry/empty states; saved summaries; approval |
| Frontend `/roadmaps/:id` | ✅ Verified | Overview, goal/duration/level, ordered milestones, tasks, completion criteria, resources, status/approval |
| Settings AI card | ✅ Verified | Real `configured`/provider/model/message; explicitly states the key stays on the backend |
| Config plumbing | ✅ Implemented | AI/rate-limit variables added to `.env.example` and Compose; no credentials in source |
| Backend tests | ✅ 130 passed | `pytest` (includes all Phase 1–3 regressions) |
| Frontend tests | ✅ 83 passed | `vitest run` — 13 files |
| Lint / format / typecheck / build / audit | ✅ Clean | `ruff check`, `ruff format --check`, `tsc --noEmit`, `vite build`, `npm audit` (0 vulnerabilities) |

---

## 3. Not implemented (honestly unavailable)

The following are **not** built and are labelled as such in the UI:

- weekly and daily planning (Phase 5);
- progress tracking, XP, levels, streaks, achievements, analytics (Phase 6);
- nutrition and fitness (Phase 7);
- academics and cybersecurity trackers (Phase 8);
- sleep and discipline tracking (Phase 9);
- AI coach chat (Phase 10);
- adaptive roadmap updates (Phase 11).

Roadmap milestone/task statuses are persisted as `pending`, but there is **no
UI or API to mark progress yet**. No checkbox pretends to save anything. There
is no mock data, no fake API response, no invented chart, and no XP/progress
value anywhere.

---

## 4. Verification log (actual commands & results)

### Backend (`backend/`)

```
..\.venv\Scripts\python.exe -m pytest -q
  → 130 passed, 1 warning (third-party Starlette httpx deprecation only)

..\.venv\Scripts\python.exe -m ruff check .
  → All checks passed!

..\.venv\Scripts\python.exe -m ruff format --check .
  → 69 files already formatted
```

Phase 4 test coverage includes:

- **Provider/config**: configured vs not configured, model/base URL wiring,
  retry on transient failure, no retry on validation failure, connect/request
  timeout handling, truncated (`finish_reason=length`) and malformed response
  rejection, key non-exposure, rate-limit mapping;
- **Prompts**: injection text cannot escape its data section, answers/fields are
  clipped, and oversized context is rejected before any call;
- **Generation**: eligible/ineligible goals, successful persistence, provider
  failure leaves no rows, request-scoped commit regression, duplicate
  idempotency keys, conflicting keys, private data exclusion, rate limiting;
- **Retrieval/ownership**: list/detail/approve are owner-scoped, cross-user
  responses are identical to missing records, goal deletion cascades;
- **Migration**: `0004` creates the four roadmap tables, downgrades cleanly, and
  preserves existing data;
- **Phase 1–3 regressions**: health, auth/session/profile, goals, onboarding,
  security, and migrations.

### Frontend (`frontend/`)

```
npx tsc --noEmit   → no errors (TypeScript strict)
npx vitest run     → Test Files 13 passed (13); Tests 83 passed (83)
npx vite build     → built successfully
npm audit          → found 0 vulnerabilities
```

Frontend test coverage includes API client (method/body/CSRF/error handling,
roadmap namespace), auth/routes, goals, onboarding, dashboard, sidebar, settings
AI status, roadmaps listing (loading, unconfigured, empty, generation success,
generation error + same-key retry, list error + retry, saved summaries,
approval), roadmap detail (loading, structured content, approval, load error +
retry, 404), and route-level protection for `/roadmaps` and
`/roadmaps/:roadmapId`.

### Phase 4 live verification (Docker Compose, PostgreSQL)

```
docker compose config --quiet                  → exit 0
docker compose up -d --build backend frontend  → backend healthy; frontend serves the SPA
docker compose exec backend alembic current    → 0004 (head)
docker compose exec backend alembic history    → 0001 → 0002 → 0003 → 0004
```

A temporary Compose override pointed `AI_BASE_URL` at a **local mock
OpenAI-compatible HTTP server** running inside the backend container. The
override and mock were removed afterwards; no real provider was contacted.

End-to-end API journey (32/32 checks, throwaway accounts):

```
POST /api/auth/register                    → 201 + session
GET  /api/roadmaps/config                  → 200 configured=true, key absent
POST /api/goals (active, full assessment)  → 201
POST /api/roadmaps/generate                → 201 draft roadmap
  → 2 ordered milestones, 3 tasks, 1 resource, provider/model recorded
  → all milestone/task statuses pending; approved_at null
POST /api/roadmaps/generate (same key)     → 200 same id (no second call)
POST /api/roadmaps/generate (key for B)    → 409
GET  /api/roadmaps                         → 200 both summaries, no nested data
GET  /api/roadmaps/{id}                    → 200 full detail
POST /api/roadmaps/{id}/approve            → 200 active + approved_at
POST /api/roadmaps/{id}/approve (again)    → 200 (idempotent)
POST /api/roadmaps/{id2}/approve           → 200 active
GET  the first roadmap                     → 200 archived (kept, not deleted)
GET/POST cross-user roadmap/approve        → 404 identical to missing
POST cross-user generate                   → 404 "Goal not found."
GET  other user's list                     → 200 []
DELETE goal B                              → 204; its roadmap → 404; goal A plans intact
```

Additional live checks:

- Restarted the backend, then re-read the active roadmap with the same session:
  **200** with all milestones/tasks/resources intact (PostgreSQL persistence).
- Stopped the mock provider and attempted generation: **502** with
  `"No roadmap was saved."`; the user's roadmap list count was unchanged.
- Removed the override, recreating the backend with `AI_PROVIDER=none`:
  `/api/roadmaps/config` → `configured: false`; generation → **503**; existing
  roadmaps remained readable.
- Database before/after: Phase 1–3 rows preserved (users 8→12 from throwaway
  accounts, goals 5→8, assessments 4→7, onboarding 3 unchanged); roadmap tables
  contain only the E2E rows above.
- `.env` was never printed or modified; `docker compose down -v` was never used;
  no unrelated containers or dev accounts were touched.

> PowerShell displays Docker/npm/pytest progress on stderr as a red
> `NativeCommandError` even when the command exits **0**. This is a display
> artifact; exit codes were checked.

---

## 5. Defects found and fixed during verification

- **`create_goal` never committed its transaction** (Phase 3): goals were
  flushed but not committed, and the request-scoped session closes (rolling
  back) at the end of every request. The create returned 201 but the goal was
  discarded, breaking duplicate detection, onboarding completion, and listing.
  Fixed by adding `self._session.commit()` and a production-lifecycle regression
  test that uses one short-lived session per request.
- **Onboarding wizard state clobbered mid-flow** (Phase 3): saving the profile
  re-ran the full load and discarded in-progress answers. Fixed by decoupling
  the initial load from the mutable user object.
- **Freshly selected goal had no stored name** (Phase 3): the default category
  label was displayed but not written to state. Fixed by seeding the name when a
  category is toggled on.
- **Migration `0001` syntax error** (Phase 1): `sa.sql.expression.true()` was
  passed positionally after keyword arguments. Fixed, migration files are now
  linted, and `test_migrations.py` runs upgrade + downgrade.
- **Test isolation leak** (Phase 2): a non-default SQLAlchemy join mode leaked
  committed rows between SQLite tests. Fixed with default session nesting and
  guarded rollback.
- **Phase 4 product defects:** none found. One bug in the ad-hoc PowerShell E2E
  harness (counting a JSON array after `ConvertFrom-Json`, which returns a
  single array object) produced four false failures; the harness was corrected
  and the product re-verified 32/32.

---

## 6. Known limitations

- **No real AI provider is configured by default.** With `AI_PROVIDER=none`,
  generation is unavailable by design; it reports `503` and never fabricates a
  roadmap. A real OpenAI-compatible endpoint must be configured explicitly.
- No real paid AI call was made during development. All provider behaviour was
  verified with mocks / a local mock server.
- AI output is validated for **structure and bounds**, not factual accuracy.
  A structurally valid but poor-quality plan is possible.
- Prompt-injection mitigations reduce risk but cannot eliminate semantic
  manipulation by a model.
- Only OpenAI-compatible Chat Completions is implemented. JSON mode is requested
  but can be disabled for endpoints that do not support it.
- Generation is synchronous; a request can take up to the configured provider
  timeout (the browser allows 180s).
- The duplicate-call guard and rate limiting are **in-process and per-instance**
  (not shared across replicas). The database unique constraint remains the
  durable idempotency guarantee.
- Roadmap progress is read-only in Phase 4. Milestones/tasks start `pending`;
  marking them complete belongs to Phase 5 and later.
- One active roadmap per goal; approving a newer plan archives the previous one.
- A goal's category cannot be changed after its assessment is answered; delete
  and recreate the goal to change category.
- The frontend container runs the Vite **development** server; code changes need
  `docker compose up --build`.
- `id`s have no database-level default by design (the ORM generates them).
- Tests run on SQLite; PostgreSQL migration and persistence behaviour is verified
  operationally against the live container.
- Session cookies are `Secure` only when `COOKIE_SECURE=true`; local HTTP uses
  `false`.

---

## 7. Required environment variables

See `.env.example`. `SECRET_KEY` is **mandatory**. AI variables are optional and
default to an honest unconfigured state.

| Variable | Required now | Notes |
| --- | --- | --- |
| `SECRET_KEY` | **Yes** | Signs session tokens. Must be ≥ 32 chars; the backend refuses to start otherwise. |
| `DATABASE_URL` | When running the backend on the host | Compose sets it automatically. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | No (defaults) | Dev placeholders only. |
| `BACKEND_CORS_ORIGINS` | No | Defaults to the Vite origins. |
| `SESSION_LIFETIME_DAYS`, `COOKIE_SECURE` | No | Defaults `30`, `false`. |
| `AUTH_RATE_LIMIT_*` | No | Defaults `10` / `60`. |
| `AI_PROVIDER` | No | Default `none`. Set `openai` to enable generation. |
| `AI_API_KEY`, `AI_MODEL` | For real generation | Backend-only; never committed, logged, or returned. |
| `AI_BASE_URL` | No | Default OpenAI; any compatible endpoint works. |
| `AI_CONNECT_TIMEOUT_SECONDS`, `AI_REQUEST_TIMEOUT_SECONDS`, `AI_MAX_RETRIES` | No | Bounded network behaviour. |
| `AI_MAX_OUTPUT_TOKENS`, `AI_TEMPERATURE`, `AI_JSON_MODE` | No | Output controls. |
| `ROADMAP_RATE_LIMIT_*` | No | Default 5 per 300s per user. |
| Host ports (`POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`) | No | Change to avoid conflicts. |

---

## 8. Exact startup commands

```powershell
# From the project root (D:\projects\MAXIMUS)
Copy-Item .env.example .env      # first time only, then set a real SECRET_KEY
docker compose up --build -d
docker compose ps
Start-Process http://localhost:5173   # (or :5183 in this environment)

# Stop (keeps data)
docker compose down
```

> Generate the session secret before the first start:
> `python -c "import secrets; print(secrets.token_urlsafe(48))"` and put it in
> `.env` as `SECRET_KEY=…`.
>
> **Never run `docker compose down -v` unless you intend to delete all data.**

To enable real roadmap generation, add real values to the local `.env`:

```dotenv
AI_PROVIDER=openai
AI_API_KEY=your-key-here
AI_MODEL=your-model-id
AI_BASE_URL=https://api.openai.com/v1
```

Then rebuild the backend (`docker compose up -d --build backend`). The Settings
page and `GET /api/roadmaps/config` will show `Configured`; the key is never
sent to the browser.

---

## 9. Recommended next phase

**Phase 5 — Weekly & Daily Planning** per `docs/DEVELOPMENT_PLAN.md`: turn the
active roadmap's milestones and tasks into a realistic weekly plan and daily
actions, using the existing goals, roadmap, onboarding-availability, and
deterministic scheduling logic. Progress updates (status transitions) should be
added with owner-scoped APIs and the same idempotency/validation discipline.
