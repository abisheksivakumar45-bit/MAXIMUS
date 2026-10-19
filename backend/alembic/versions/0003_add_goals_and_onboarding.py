"""create goals, goal_assessments, and user_onboarding tables

Adds goal management and onboarding persistence for Phase 3. Every new table
references ``users.id`` with ``ON DELETE CASCADE`` so ownership is enforced at
the database level. Assessment answers are stored as ``jsonb`` on PostgreSQL
(indexable, native JSON semantics) and plain JSON on the SQLite used by the
migration tests.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-18

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | list[str] | None = None
depends_on: str | list[str] | None = None

#: ``jsonb`` on PostgreSQL; plain JSON on SQLite (migration tests).
json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    _create_goals()
    _create_goal_assessments()
    _create_user_onboarding()


def _create_goals() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("motivation", sa.Text(), nullable=True),
        sa.Column("current_situation", sa.Text(), nullable=True),
        sa.Column("desired_outcome", sa.Text(), nullable=True),
        sa.Column(
            "priority",
            sa.String(length=16),
            server_default="medium",
            nullable=False,
        ),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("available_time", sa.String(length=120), nullable=True),
        sa.Column("constraints", sa.Text(), nullable=True),
        sa.Column("preferences", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_goals_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goals")),
        sa.UniqueConstraint(
            "user_id",
            "category",
            "name",
            name="uq_goals_user_category_name",
        ),
    )
    op.create_index(op.f("ix_goals_user_id"), "goals", ["user_id"])
    op.create_index(op.f("ix_goals_category"), "goals", ["category"])
    op.create_index(op.f("ix_goals_status"), "goals", ["status"])


def _create_goal_assessments() -> None:
    op.create_table(
        "goal_assessments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("answers", json_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["goals.id"],
            name=op.f("fk_goal_assessments_goal_id_goals"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_goal_assessments_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_assessments")),
        sa.UniqueConstraint("goal_id", name="uq_goal_assessments_goal_id"),
    )
    op.create_index(op.f("ix_goal_assessments_user_id"), "goal_assessments", ["user_id"])


def _create_user_onboarding() -> None:
    op.create_table(
        "user_onboarding",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("age_range", sa.String(length=32), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("preferred_language", sa.String(length=32), nullable=True),
        sa.Column("wake_time", sa.String(length=5), nullable=True),
        sa.Column("bedtime", sa.String(length=5), nullable=True),
        sa.Column("daily_availability", sa.String(length=32), nullable=True),
        sa.Column("schedule", sa.String(length=64), nullable=True),
        sa.Column("study_hours_per_day", sa.String(length=32), nullable=True),
        sa.Column("food_budget", sa.String(length=32), nullable=True),
        sa.Column("food_preferences", sa.String(length=255), nullable=True),
        sa.Column("exercise_experience", sa.String(length=32), nullable=True),
        sa.Column("equipment", json_type, nullable=True),
        sa.Column("existing_routines", sa.String(length=255), nullable=True),
        sa.Column("planning_style", sa.String(length=32), nullable=True),
        sa.Column("current_step", sa.String(length=32), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_onboarding_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_onboarding")),
        sa.UniqueConstraint("user_id", name="uq_user_onboarding_user_id"),
    )
    op.create_index(op.f("ix_user_onboarding_user_id"), "user_onboarding", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_user_onboarding_user_id"), table_name="user_onboarding")
    op.drop_table("user_onboarding")
    op.drop_index(op.f("ix_goal_assessments_user_id"), table_name="goal_assessments")
    op.drop_table("goal_assessments")
    op.drop_index(op.f("ix_goals_status"), table_name="goals")
    op.drop_index(op.f("ix_goals_category"), table_name="goals")
    op.drop_index(op.f("ix_goals_user_id"), table_name="goals")
    op.drop_table("goals")
