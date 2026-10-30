# MAXIMUS

MAXIMUS is an AI-powered personal growth and life-management web application.
It is designed to turn personal ambitions into structured roadmaps, realistic
daily plans, measurable actions, and continuous improvement.

> **Development status: Phase 4 — Roadmap Engine & AI Provider.**
> The application shell, backend, PostgreSQL database, migrations, health
> endpoints, local development stack, **authentication + profile**, **goals and
> onboarding**, and **AI-generated, validated roadmaps** are implemented and
> verified. Later features (weekly/daily planning, XP, nutrition, fitness, AI
> coaching, …) are **not** implemented and are labelled honestly in the UI.
> See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

The authoritative product specification is [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md).

---

## 1. Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Docker Desktop | 29.x with Compose v2 | Required for the one-command workflow. |
| Python | 3.14 | Only needed for local (non-Docker) backend development. |
| Node.js | 24 LTS | Only needed for local (non-Docker) frontend development. |
| Git | any recent | For version control. |

On Windows 11, install Docker Desktop with the WSL 2 backend and make sure it is
**running** before starting the stack.

---

## 2. Quick start (Docker Compose) — recommended

From the project root in PowerShell (or a VS Code terminal):

```powershell
# 1. Create your local environment file (once)
Copy-Item .env.example .env

# 2. Set a real session secret in .env
python -c "import secrets; print(secrets.token_urlsafe(48))"

# 3. Build and start PostgreSQL + backend + frontend
docker compose up --build -d

# 4. Check that everything is healthy
docker compose ps

# 5. Open the app
Start-Process http://localhost:5173
```

- Frontend: <http://localhost:5173>
- API docs (development only): <http://localhost:8000/api/docs>
- Health: <http://localhost:8000/api/health>

Stop the stack (database data is preserved in a named volume):

```powershell
docker compose down
```

> **Warning:** `docker compose down -v` deletes the database volume and all
> local data. Do not run it unless you intend to destroy the database.

Follow logs / rebuild after code changes:

```powershell
docker compose logs -f
docker compose up --build -d
```

> The frontend image runs the Vite **development server**. Code changes are
> baked into the image, so rebuild with `docker compose up --build`. For hot
> reload without rebuilding, run the services locally (section 4).

---

## 3. Environment variables

Copy `.env.example` to `.env` and adjust as needed. The real `.env` is
git-ignored and must never be committed.

| Variable | Default (dev) | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | Environment label; hides API docs in `production`. |
| `APP_VERSION` | `0.1.0` | Reported by `/api/health`. |
| `LOG_LEVEL` | `INFO` | Backend log level. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `maximus_dev` / `change_me_local_only` / `maximus_dev` | Database credentials (**development placeholders**). |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL. |
| `DATABASE_URL` | `postgresql+psycopg://…@localhost:5432/maximus_dev` | Used when running the backend on the host. URL-encode special characters. |
| `BACKEND_PORT` | `8000` | Host port for the API. |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins (strict CORS, credentials enabled). |
| `SECRET_KEY` | *(required)* | Signs session tokens. **Must be ≥ 32 characters**; the backend refuses to start otherwise. |
| `SESSION_LIFETIME_DAYS` | `30` | Sliding session lifetime in days. |
| `COOKIE_SECURE` | `false` | Session cookie `Secure` flag. Set `true` behind HTTPS. |
| `AUTH_RATE_LIMIT_ATTEMPTS` / `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `10` / `60` | Auth rate limit. |
| `AI_PROVIDER` | `none` | `none` (offline, honest unconfigured state) or `openai`. |
| `AI_API_KEY` | *(empty)* | Backend-only provider key. Never sent to the browser or logged. |
| `AI_MODEL` | *(empty)* | Model id sent to the provider. |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible Chat Completions base URL. |
| `AI_CONNECT_TIMEOUT_SECONDS` / `AI_REQUEST_TIMEOUT_SECONDS` | `10` / `60` | Network bounds. |
| `AI_MAX_RETRIES` | `2` | Bounded retries (0–5) for transient failures. |
| `AI_MAX_OUTPUT_TOKENS` / `AI_TEMPERATURE` / `AI_JSON_MODE` | `4000` / `0.3` / `true` | Output controls. |
| `ROADMAP_RATE_LIMIT_ATTEMPTS` / `ROADMAP_RATE_LIMIT_WINDOW_SECONDS` | `5` / `300` | Expensive generation limit per authenticated user. |
| `FRONTEND_PORT` | `5173` | Host port for the UI. |
| `VITE_API_BASE_URL` | *(empty)* | Empty = use the dev-server `/api` proxy. |

### Enabling real roadmap generation

By default `AI_PROVIDER=none`. The application still runs fully, but roadmap
generation reports **not configured** and makes no outbound call. To enable it,
put real values in your local `.env` (never commit them):

```dotenv
AI_PROVIDER=openai
AI_API_KEY=your-key-here
AI_MODEL=your-model-id
AI_BASE_URL=https://api.openai.com/v1
```

Rebuild the backend (`docker compose up -d --build backend`). The Settings page
and `GET /api/roadmaps/config` will show the real status; the key is never
returned to the browser.

---

## 4. Local development without Docker

You still need PostgreSQL running — the easiest way is to start just the
database container:

```powershell
docker compose up -d db
```

### Backend (FastAPI)

```powershell
# One-time setup
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt

# Apply migrations, then run the API
cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The backend reads `DATABASE_URL` from `backend/.env` or the process
environment. When running on the host, point it at `localhost`:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://maximus_dev:change_me_local_only@localhost:5432/maximus_dev"
```

### Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000` by default. Open
<http://localhost:5173>.

---

## 5. Testing and checks

Backend (from `backend/`):

```powershell
..\.venv\Scripts\python.exe -m pytest        # 130 tests (SQLite; provider mocked)
..\.venv\Scripts\python.exe -m ruff check .
..\.venv\Scripts\python.exe -m ruff format --check .
```

Frontend (from `frontend/`):

```powershell
npm run typecheck   # tsc --noEmit (TypeScript strict)
npm test            # 83 tests (Vitest + React Testing Library)
npm run build       # production build
npm audit           # dependency audit
```

Tests **never** call a real AI provider. Provider tests use `httpx.MockTransport`;
generation tests use an in-memory fake.

---

## 6. Health and API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service banner (name, version, docs link). |
| `GET` | `/api/health` | Service metadata. No DB access. |
| `GET` | `/api/health/live` | Liveness probe. |
| `GET` | `/api/health/ready` | Readiness probe (`SELECT 1`); **503** if PostgreSQL is unreachable. |
| `POST` | `/api/auth/register` | Create an account and start a session. |
| `POST` | `/api/auth/login` | Authenticate and start a session. |
| `POST` | `/api/auth/logout` | Revoke the current session. |
| `GET` | `/api/auth/me` | Restore auth state. |
| `GET` / `PATCH` | `/api/profile` | Read/update the display name. |
| `GET` | `/api/goals/categories` | Canonical categories and assessment questions. |
| `GET` / `POST` | `/api/goals` | List/create the current user's goals. |
| `GET` / `PATCH` / `DELETE` | `/api/goals/{id}` | Read/update/delete one owned goal. |
| `GET` / `PUT` | `/api/onboarding` | Read/partially save resumable onboarding; completion is server-validated. |
| `GET` | `/api/roadmaps/config` | Non-sensitive AI provider status (never the key). |
| `GET` | `/api/roadmaps` | List the current user's roadmap summaries. |
| `POST` | `/api/roadmaps/generate` | Generate, validate, and persist a roadmap for an owned active/paused goal. Supports an optional idempotency key. |
| `GET` | `/api/roadmaps/{id}` | Full roadmap with ordered milestones, tasks, and resources. |
| `POST` | `/api/roadmaps/{id}/approve` | Make an owned roadmap the active plan for its goal. |
| `GET` | `/api/docs` | Interactive OpenAPI docs (disabled in production). |

Authentication uses an **opaque, server-managed session** in an `HttpOnly`
cookie (`maximus_session`). State-changing requests must also echo the
double-submit CSRF token from the non-`HttpOnly` `maximus_csrf` cookie in the
`X-CSRF-Token` header; the frontend API client does this automatically.

### Roadmap generation semantics

- Only `active` or `paused` goals can be planned; draft/completed/archived goals
  are rejected with `400`.
- A successful first generation returns `201`; replaying the same idempotency
  key returns `200` with the same roadmap and makes no second provider call.
- Reusing a key for a different goal returns `409`.
- Provider failures return `502`/`503`/`504` and save **nothing**.
- Generation is rate-limited per authenticated user.
- Approving a roadmap activates it; a previously active plan for the same goal
  is archived, not deleted.

---

## 7. Database and migrations

PostgreSQL 16 runs in the `db` service with a named volume (`maximus_pgdata`),
so data survives `docker compose down`. The backend applies migrations on
startup (`alembic upgrade head`).

```powershell
# Inspect the applied revision
docker compose exec backend alembic current

# Apply migrations manually
docker compose exec backend alembic upgrade head

# Roll back one revision
docker compose exec backend alembic downgrade -1

# Open a psql shell
docker compose exec db psql -U maximus_dev -d maximus_dev
```

Applied revisions: `0001` users → `0002` sessions → `0003` goals/onboarding →
`0004` roadmaps. See [`docs/DATABASE.md`](docs/DATABASE.md) for schema
conventions.

---

## 8. Project structure

```
MAXIMUS/
├── backend/          FastAPI + SQLAlchemy + Alembic (see docs/ARCHITECTURE.md)
├── frontend/         React + TypeScript + Vite + Tailwind
├── docs/             Master spec and supporting documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `failed to connect to the docker API` | Docker Desktop is not running. Start it and retry. |
| `/api/health/ready` returns 503 | PostgreSQL is still starting or misconfigured. Check `docker compose logs db` and `docker compose ps`. |
| Frontend loads but shows "Could not reach the MAXIMUS backend" | Backend not up yet. Check `docker compose logs backend`; the UI offers a retry. |
| Roadmaps page says "AI generation is not configured" | Expected with `AI_PROVIDER=none`. Set real `AI_*` values to enable generation. |
| Generation returns 503/502/504 | Provider not configured, unreachable/rate-limited, or timed out. No roadmap was saved; check the message and retry. |
| Port already in use (`5432`, `8000`, `5173`) | A service or another project's containers may hold the port. Set different `POSTGRES_PORT` / `BACKEND_PORT` / `FRONTEND_PORT` values in `.env`, then `docker compose up -d`. |
| Password with special characters fails to connect | URL-encode it in `DATABASE_URL`. |

---

## 10. Documentation

- [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md) — authoritative specification.
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — product summary.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design and decisions.
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema conventions and migrations.
- [`docs/AI_DESIGN.md`](docs/AI_DESIGN.md) — implemented AI provider design.
- [`docs/SECURITY.md`](docs/SECURITY.md) — security posture and controls.
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) — phase-by-phase plan.
- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — what is implemented and verified.
