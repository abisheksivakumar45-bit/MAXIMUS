# MAXIMUS — Database

PostgreSQL is the persistent source of truth. The schema is managed with
SQLAlchemy 2.x models and Alembic migrations.

## 1. Conventions

- **Primary keys**: UUID (`sa.Uuid`), generated in Python (`uuid.uuid4`).
- **Timestamps**: every table has `created_at` / `updated_at`
  (`TIMESTAMPTZ`, server default `now()`, `updated_at` auto-updates).
- **Ownership**: user-owned tables reference `users.id`. Child rows use
  `ON DELETE CASCADE`; deleting a user must never orphan records.
- **Constraints**: unique constraints and indexes are declared explicitly.
- **No secrets**: sensitive data is stored only when required, and passwords
  are only ever stored as hashes (Phase 2).

## 2. Current tables (Phase 1)

### `users`

The ownership root. Created in migration `0001`. Authentication endpoints do
not exist yet — the table is created now because every later user-owned table
depends on it, and doing so avoids a throwaway baseline migration.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `email` | VARCHAR(320) | Unique, indexed. |
| `password_hash` | VARCHAR(255) | Hash only — never plaintext. |
| `display_name` | VARCHAR(120) | Nullable. |
| `is_active` | BOOLEAN | Default `true`; used to disable accounts. |
| `created_at` | TIMESTAMPTZ | Server default `now()`. |
| `updated_at` | TIMESTAMPTZ | Server default `now()`, auto-updated. |

The wider table set (goals, roadmaps, daily tasks, XP transactions, …) is
introduced in the phases that implement their features — see
`docs/DEVELOPMENT_PLAN.md`. Tables are added only when justified by real
implementation, never speculatively.

## 3. Migrations

Alembic reads `DATABASE_URL` from the environment (`alembic/env.py`); the URL is
never stored in `alembic.ini` or version control.

```bash
# Inside the backend container (compose runs this automatically on startup):
docker compose exec backend alembic upgrade head

# Locally (with the venv active and .env pointing at a reachable database):
cd backend
alembic upgrade head          # apply all migrations
alembic downgrade -1          # roll back one revision
alembic revision -m "message" # create a new (empty) migration
alembic history               # list revisions
```

`render_as_batch=True` is enabled in `env.py`. On PostgreSQL this is inert; it
keeps local SQLite-based experiments (and the test environment) workable.

Rules:

- Never rely on automatic table creation/recreation in a running app.
- Never edit an applied migration — add a new one.
- Migrations must be reversible (`downgrade()` implemented).

## 4. Testing

The pytest suite provisions an in-memory SQLite database via
`Base.metadata.create_all` and rolls back per test. This is intentional and
isolated from real data: it verifies model/schema/endpoint behaviour quickly.

Migration correctness against PostgreSQL is verified operationally (see the
verification log in `docs/IMPLEMENTATION_STATUS.md`) using
`docker compose up` + `docker compose exec backend alembic current`.
