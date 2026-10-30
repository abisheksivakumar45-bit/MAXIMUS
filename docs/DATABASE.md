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

## 2. Current tables (Phase 4)

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

### `goals`

Added in migration `0003`. One row per goal; the ownership root for
Phase 5+ (weekly plans, daily tasks, progress history will reference `goals.id`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. |
| `name` | VARCHAR(120) | Required. Part of the uniqueness rule below. |
| `description` | TEXT | Nullable. |
| `category` | VARCHAR(64) | Canonical category slug; validated in the application layer against `app/core/goal_categories.py` (a CHECK constraint would duplicate that list). Indexed. |
| `motivation`, `current_situation`, `desired_outcome` | TEXT | Nullable goal-context fields. |
| `priority` | VARCHAR(16) | `low` / `medium` / `high`; default `medium`. |
| `target_date` | DATE | Nullable. |
| `available_time` | VARCHAR(120) | Nullable. |
| `constraints`, `preferences` | TEXT | Nullable. |
| `status` | VARCHAR(16) | `draft` / `active` / `paused` / `completed` / `archived`; default `draft`. Indexed. |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

Constraint `uq_goals_user_category_name` — unique (`user_id`, `category`,
`name`): one user cannot have two goals with the same name in the same
category.

### `goal_assessments`

Added in migration `0003`. Exactly one row per goal (1:1) holding the
category-specific onboarding answers.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `goal_id` | UUID | FK → `goals.id`, `ON DELETE CASCADE`; **unique** (`uq_goal_assessments_goal_id`) — one assessment per goal. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. Denormalised owner so every read is scoped to the caller without joining through `goals`. |
| `answers` | JSONB (JSON on SQLite) | Answer map validated at the application layer against the category's field spec (kinds, choices, required, max lengths). |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

### `user_onboarding`

Added in migration `0003`. One row per user (created lazily on first save);
holds the answers to onboarding screens 2–3 plus resume/completion state.
Goal selection is **not** duplicated here — the user's goals are the truth.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`; **unique** — one row per user. |
| `age_range`, `timezone`, `preferred_language`, `wake_time`, `bedtime`, `daily_availability` | VARCHAR | Screen 2 (basic profile); `wake_time`/`bedtime` are `HH:MM`. All nullable. |
| `schedule`, `study_hours_per_day`, `food_budget`, `food_preferences`, `exercise_experience`, `equipment`, `existing_routines`, `planning_style` | VARCHAR / JSONB | Screen 3 (lifestyle); `equipment` is a list of allowed values. All nullable. |
| `current_step` | VARCHAR(32) | The step to resume at (`welcome`…`review`). |
| `completed_at` | TIMESTAMPTZ | Nullable; set **by the server** only once every required answer exists. |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

### `roadmaps`

Added in migration `0004`. One row per generated plan; belongs to exactly one
user and one goal. The full hierarchy is normalised rather than stored as a JSON
blob, so later progress/adaptation can attach to real rows.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. Denormalised owner for scoped reads. |
| `goal_id` | UUID | FK → `goals.id`, `ON DELETE CASCADE`, indexed. Deleting a goal removes its plans. |
| `title` | VARCHAR(160) | Required. |
| `description`, `objective` | TEXT | Required overview and objective. |
| `starting_level`, `target_level` | VARCHAR(120) | Required. |
| `estimated_duration_weeks` | INTEGER | Required. |
| `status` | VARCHAR(16) | `draft` / `active` / `archived`; default `draft`, indexed. |
| `provider`, `model` | VARCHAR(32) / VARCHAR(100) | Provenance of the generated content (never a credential). |
| `generation_key` | VARCHAR(64) | Nullable client idempotency key, unique per user (`uq_roadmaps_user_generation_key`). |
| `approved_at` | TIMESTAMPTZ | Nullable; set when the roadmap becomes active. |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

Approving a roadmap sets it `active` and archives any other `active` roadmap for
the same goal (the previous plan is kept, not deleted).

### `roadmap_milestones`

Added in migration `0004`. Ordered phases inside a roadmap.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `roadmap_id` | UUID | FK → `roadmaps.id`, `ON DELETE CASCADE`, indexed. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. |
| `position` | INTEGER | Zero-based order; unique with `roadmap_id`. |
| `title` | VARCHAR(160) | Required. |
| `description`, `completion_criteria` | TEXT | Required. |
| `estimated_duration_weeks` | INTEGER | Required. |
| `status` | VARCHAR(16) | `pending` (default) / `in_progress` / `completed` / `skipped`; Phase 4 writes only `pending`. |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

### `roadmap_tasks`

Added in migration `0004`. Actionable items inside a milestone.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `milestone_id` | UUID | FK → `roadmap_milestones.id`, `ON DELETE CASCADE`, indexed. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. |
| `position` | INTEGER | Zero-based order; unique with `milestone_id`. |
| `title` | VARCHAR(200) | Required. |
| `description` | TEXT | Required. |
| `estimated_minutes` | INTEGER | Nullable. |
| `completion_criteria` | TEXT | Nullable. |
| `status` | VARCHAR(16) | Same item status set; default `pending`. |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

### `roadmap_resources`

Added in migration `0004`. Optional learning resources attached to a milestone.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key. |
| `milestone_id` | UUID | FK → `roadmap_milestones.id`, `ON DELETE CASCADE`, indexed. |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE`, indexed. |
| `position` | INTEGER | Zero-based order; unique with `milestone_id`. |
| `title` | VARCHAR(200) | Required. |
| `resource_type` | VARCHAR(32) | `book` / `course` / `video` / `article` / `practice` / `tool` / `other`. |
| `url` | VARCHAR(500) | Nullable; validated as an HTTP(S) URL in the AI output schema. |
| `note` | TEXT | Nullable. |
| `created_at` / `updated_at` | TIMESTAMPTZ | Server defaults. |

Weekly plans, daily tasks, XP transactions, and the remaining Phase 5+ tables are
introduced in the phases that implement their features — see
`docs/DEVELOPMENT_PLAN.md`. Tables are added only when justified by real
implementation, never speculatively.

## 3. Migrations

Applied revisions (as of Phase 4): `0001` (baseline `users`) → `0002`
(`auth_sessions`) → `0003` (`goals`, `goal_assessments`, `user_onboarding`) →
`0004` (`roadmaps`, `roadmap_milestones`, `roadmap_tasks`,
`roadmap_resources`). Alembic reads `DATABASE_URL` from the environment
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
`test_migrations.py` additionally runs the real Alembic chain (upgrade to head,
downgrade through `0004`) against a temporary database, and roadmap tests verify
goal-deletion cascades across all four tables.

Migration correctness against PostgreSQL is verified operationally (see the
verification log in `docs/IMPLEMENTATION_STATUS.md`) using
`docker compose up` + `docker compose exec backend alembic current`.
