"""create roadmaps, roadmap_milestones, roadmap_tasks, and roadmap_resources

Adds the Phase 4 roadmap engine. Content is stored as normalised rows (not one
JSON blob) so future planning and progress features can join to milestones and
tasks. Every table references ``users.id`` and its parent with
``ON DELETE CASCADE``.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-30

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | list[str] | None = None
depends_on: str | list[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
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
    ]


def _user_fk(table: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["user_id"],
        ["users.id"],
        name=op.f(f"fk_{table}_user_id_users"),
        ondelete="CASCADE",
    )


def upgrade() -> None:
    _create_roadmaps()
    _create_roadmap_milestones()
    _create_roadmap_tasks()
    _create_roadmap_resources()


def _create_roadmaps() -> None:
    op.create_table(
        "roadmaps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("starting_level", sa.String(length=120), nullable=False),
        sa.Column("target_level", sa.String(length=120), nullable=False),
        sa.Column("estimated_duration_weeks", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("generation_key", sa.String(length=64), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["goals.id"],
            name=op.f("fk_roadmaps_goal_id_goals"),
            ondelete="CASCADE",
        ),
        _user_fk("roadmaps"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roadmaps")),
        sa.UniqueConstraint(
            "user_id",
            "generation_key",
            name="uq_roadmaps_user_generation_key",
        ),
    )
    op.create_index(op.f("ix_roadmaps_user_id"), "roadmaps", ["user_id"])
    op.create_index(op.f("ix_roadmaps_goal_id"), "roadmaps", ["goal_id"])
    op.create_index(op.f("ix_roadmaps_status"), "roadmaps", ["status"])


def _create_roadmap_milestones() -> None:
    op.create_table(
        "roadmap_milestones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("roadmap_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("estimated_duration_weeks", sa.Integer(), nullable=False),
        sa.Column("completion_criteria", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="pending",
            nullable=False,
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["roadmap_id"],
            ["roadmaps.id"],
            name=op.f("fk_roadmap_milestones_roadmap_id_roadmaps"),
            ondelete="CASCADE",
        ),
        _user_fk("roadmap_milestones"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roadmap_milestones")),
        sa.UniqueConstraint(
            "roadmap_id",
            "position",
            name="uq_roadmap_milestones_roadmap_position",
        ),
    )
    op.create_index(op.f("ix_roadmap_milestones_roadmap_id"), "roadmap_milestones", ["roadmap_id"])
    op.create_index(op.f("ix_roadmap_milestones_user_id"), "roadmap_milestones", ["user_id"])


def _create_roadmap_tasks() -> None:
    op.create_table(
        "roadmap_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("milestone_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("completion_criteria", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="pending",
            nullable=False,
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["milestone_id"],
            ["roadmap_milestones.id"],
            name=op.f("fk_roadmap_tasks_milestone_id_roadmap_milestones"),
            ondelete="CASCADE",
        ),
        _user_fk("roadmap_tasks"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roadmap_tasks")),
        sa.UniqueConstraint(
            "milestone_id",
            "position",
            name="uq_roadmap_tasks_milestone_position",
        ),
    )
    op.create_index(op.f("ix_roadmap_tasks_milestone_id"), "roadmap_tasks", ["milestone_id"])
    op.create_index(op.f("ix_roadmap_tasks_user_id"), "roadmap_tasks", ["user_id"])


def _create_roadmap_resources() -> None:
    op.create_table(
        "roadmap_resources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("milestone_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["milestone_id"],
            ["roadmap_milestones.id"],
            name=op.f("fk_roadmap_resources_milestone_id_roadmap_milestones"),
            ondelete="CASCADE",
        ),
        _user_fk("roadmap_resources"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roadmap_resources")),
        sa.UniqueConstraint(
            "milestone_id",
            "position",
            name="uq_roadmap_resources_milestone_position",
        ),
    )
    op.create_index(
        op.f("ix_roadmap_resources_milestone_id"), "roadmap_resources", ["milestone_id"]
    )
    op.create_index(op.f("ix_roadmap_resources_user_id"), "roadmap_resources", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_roadmap_resources_user_id"), table_name="roadmap_resources")
    op.drop_index(op.f("ix_roadmap_resources_milestone_id"), table_name="roadmap_resources")
    op.drop_table("roadmap_resources")

    op.drop_index(op.f("ix_roadmap_tasks_user_id"), table_name="roadmap_tasks")
    op.drop_index(op.f("ix_roadmap_tasks_milestone_id"), table_name="roadmap_tasks")
    op.drop_table("roadmap_tasks")

    op.drop_index(op.f("ix_roadmap_milestones_user_id"), table_name="roadmap_milestones")
    op.drop_index(op.f("ix_roadmap_milestones_roadmap_id"), table_name="roadmap_milestones")
    op.drop_table("roadmap_milestones")

    op.drop_index(op.f("ix_roadmaps_status"), table_name="roadmaps")
    op.drop_index(op.f("ix_roadmaps_goal_id"), table_name="roadmaps")
    op.drop_index(op.f("ix_roadmaps_user_id"), table_name="roadmaps")
    op.drop_table("roadmaps")
