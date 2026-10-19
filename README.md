# MAXIMUS

MAXIMUS is an AI-powered personal growth and life-management web application.
It is designed to turn personal ambitions into structured roadmaps, realistic
daily plans, measurable actions, and continuous improvement.

> **Development status: Phase 3 — Goals & Onboarding.**
> The application shell, backend, PostgreSQL database, migrations, health
> endpoints, local development stack, **authentication + user profile**, and
> **goal management with onboarding** (canonical goal categories, per-category
> assessment questions, goal CRUD with per-user isolation, a multi-step
> onboarding wizard that is resumable and server-validated, draft goals that
> activate on completion) are implemented and verified. Later product features
> (roadmaps, planning, nutrition, fitness, AI coaching, …) are **not**
> implemented yet and are labelled honestly in the UI.
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

# 2. Build and start PostgreSQL + backend + frontend
docker compose up --build -d

# 3. Check that everything is healthy
docker compose ps

# 4. Open the app
Start-Process http://localhost:5173
```

- Frontend: <http://localhost:5173>
- API docs (development only): <http://localhost:8000/api/docs>
- Health: <http://localhost:8000/api/health>

Stop the stack (database data is preserved in a named volume):

```powershell
docker compose down
```

Stop and remove **all** data (destructive — deletes the database volume):

```powershell
docker compose down -v
```

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
| `DATABASE_URL` | `postgresql+psycopg://…@localhost:5432/maximus_dev` | Used when running the backend on the host. URL-encode special characters in the password. |
| `BACKEND_PORT` | `8000` | Host port for the API. |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins (strict CORS, credentials enabled for the session cookie). |
| `SECRET_KEY` | *(required, no default)* | Signs session cookies (HMAC). **Must be ≥ 32 characters**; the backend refuses to start otherwise. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `SESSION_LIFETIME_DAYS` | `30` | Sliding session lifetime in days. |
| `COOKIE_SECURE` | `false` | Set the session cookie `Secure` flag. Keep `false` for local HTTP; set `true` behind HTTPS. |
| `AUTH_RATE_LIMIT_ATTEMPTS` | `10` | Max auth requests per client per window before `429`. |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate-limit window length in seconds. |
| `FRONTEND_PORT` | `5173` | Host port for the UI. |
| `VITE_API_BASE_URL` | *(empty)* | Empty = use the dev-server `/api` proxy. |

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
..\.venv\Scripts\python.exe -m pytest        # unit/integration tests (SQLite)
..\.venv\Scripts\python.exe -m ruff check .  # lint
..\.venv\Scripts\python.exe -m ruff format --check .
```

Frontend (from `frontend/`):

```powershell
npm run typecheck   # tsc --noEmit (TypeScript strict)
npm test            # Vitest + React Testing Library
npm run build       # production build
```

---

## 6. Health and API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service banner (name, version, docs link). |
| `GET` | `/api/health` | Service metadata (name, version, environment, time). No DB access. |
| `GET` | `/api/health/live` | Liveness probe. Always 200 while the process runs. |
| `GET` | `/api/health/ready` | Readiness probe. Runs `SELECT 1`; returns **503** if PostgreSQL is unreachable. |
| `POST` | `/api/auth/register` | Create an account and start a session. |
| `POST` | `/api/auth/login` | Authenticate and start a session. |
| `POST` | `/api/auth/logout` | Revoke the current session. |
| `GET` | `/api/auth/me` | Return the authenticated user (used to restore auth state on load). |
| `GET` | `/api/profile` | Return the authenticated user's profile. |
| `PATCH` | `/api/profile` | Update the authenticated user's display name. |
| `GET` | `/api/goals/categories` | The canonical goal categories and their assessment questions (public reference data). |
| `GET` | `/api/goals` | List the current user's goals (with assessment status). |
| `POST` | `/api/goals` | Create a goal (optionally with assessment answers). Duplicate name+category → 409. |
| `GET` | `/api/goals/{id}` | Get one of the current user's goals (404 for missing or other users' goals, identical response). |
| `PATCH` | `/api/goals/{id}` | Update a goal and/or merge assessment answers. |
| `DELETE` | `/api/goals/{id}` | Delete a goal (204). |
| `GET` | `/api/onboarding` | Current onboarding progress: saved answers, option lists, and what is still missing. |
| `PUT` | `/api/onboarding` | Partially save onboarding progress (each save merges). `completed: true` is validated server-side; it only succeeds once every required answer exists. |
| `GET` | `/api/docs` | Interactive OpenAPI docs (disabled when `APP_ENV=production`). |

Authentication uses an **opaque, server-managed session** stored in an
`HttpOnly` cookie (`maximus_session`). State-changing requests must also send the
double-submit CSRF token: read the non-`HttpOnly` `maximus_csrf` cookie (set on
any safe request) and echo it in the `X-CSRF-Token` header. The frontend API
client does this automatically.

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

See [`docs/DATABASE.md`](docs/DATABASE.md) for schema conventions.

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
| Frontend loads but shows "Could not reach the MAXIMUS backend" | Backend not up yet. Check `docker compose logs backend`; the UI offers a retry once it is ready. |
| Port already in use (`5432`, `8000`, `5173`) | A service or **another project's containers** may hold the port — check with `docker ps` and `netstat -ano | findstr :8000`. Set different `POSTGRES_PORT` / `BACKEND_PORT` / `FRONTEND_PORT` values in `.env`, then `docker compose up -d` (add `--build` after code changes). Container-internal ports do not need to change. |
| Password with special characters fails to connect | URL-encode it in `DATABASE_URL`. |

---

## 10. Documentation

- [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md) — authoritative specification.
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — product summary.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design and decisions.
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema conventions and migrations.
- [`docs/AI_DESIGN.md`](docs/AI_DESIGN.md) — planned AI provider design (Phase 4+).
- [`docs/SECURITY.md`](docs/SECURITY.md) — security posture and planned controls.
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) — phase-by-phase plan.
- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — what is implemented and verified.
