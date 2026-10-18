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
- **No secrets**: passwords are stored only as Argon2id hashes, and session
  tokens only as HMAC hashes — no plaintext credential or token is ever
  persisted.

## 2. Current tables (Phase 2)

### `users`

The ownership root. Created in migration `0001`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `email` | VARCHAR(320) | Unique, indexed; normalised to lowercase. |
| `password_hash` | VARCHAR(255) | Argon2id hash only — never plaintext. |
| `display_name` | VARCHAR(120) | Nullable. |
| `is_active` | BOOLEAN | Default `true`; used to disable accounts. |
| `created_at` | TIMESTAMPTZ | Server default `now()`. |
| `updated_at` | TIMESTAMPTZ | Server default `now()`, auto-updated. |

### `auth_sessions`

Added in migration `0002`. One row per active (or revoked) login session.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. |
| `token_hash` | VARCHAR(64) | HMAC-SHA256 hex of the session token; **unique**, indexed. The raw token is never stored. |
| `created_at` | TIMESTAMPTZ | Server default `now()`. |
| `expires_at` | TIMESTAMPTZ | Indexed; enforced on every request. |
| `last_used_at` | TIMESTAMPTZ | Refreshed on use (sliding renewal). |
| `revoked_at` | TIMESTAMPTZ | Nullable; set on logout. A non-null value means the session is dead. |

The wider table set (goals, roadmaps, daily tasks, XP transactions, …) is
introduced in the phases that implement their features — see
`docs/DEVELOPMENT_PLAN.md`. Tables are added only when justified by real
implementation, never speculatively.

## 3. Migrations

Applied revisions (as of Phase 2): `0001` (baseline `users`) → `0002`
(`auth_sessions`). Alembic reads `DATABASE_URL` from the environment
(`alembic/env.py`); the URL is never stored in `alembic.ini` or version control.

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
