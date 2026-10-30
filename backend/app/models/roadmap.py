"""Roadmap, milestone, task, and resource models.

A roadmap belongs to exactly one user and one goal. Ownership is enforced at
the database level (``ON DELETE CASCADE`` from users and goals) and at the
repository level (every query is scoped to the user id).

The hierarchy is deliberately normalised rather than stored as one JSON blob:

``roadmaps`` → ``roadmap_milestones`` → ``roadmap_tasks``
                              ↘ ``roadmap_resources``

Status columns on milestones and tasks exist so Phase 5/6 progress tracking can
attach to real records later without a migration of the roadmap itself. Nothing
in Phase 4 writes any status other than the default.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.goal_categories import get_category
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.goal import Goal

ROADMAP_STATUSES = ("draft", "active", "archived")
DEFAULT_ROADMAP_STATUS = "draft"

ITEM_STATUSES = ("pending", "in_progress", "completed", "skipped")
DEFAULT_ITEM_STATUS = "pending"

ROADMAP_TITLE_MAX_LENGTH = 160
ROADMAP_LEVEL_MAX_LENGTH = 120
MILESTONE_TITLE_MAX_LENGTH = 160
TASK_TITLE_MAX_LENGTH = 200
RESOURCE_TITLE_MAX_LENGTH = 200
RESOURCE_URL_MAX_LENGTH = 500
RESOURCE_TYPES = ("book", "course", "video", "article", "practice", "tool", "other")


class Roadmap(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An approved or pending plan for one goal."""

    __tablename__ = "roadmaps"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "generation_key",
            name="uq_roadmaps_user_generation_key",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(ROADMAP_TITLE_MAX_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    starting_level: Mapped[str] = mapped_column(String(ROADMAP_LEVEL_MAX_LENGTH), nullable=False)
    target_level: Mapped[str] = mapped_column(String(ROADMAP_LEVEL_MAX_LENGTH), nullable=False)
    estimated_duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=DEFAULT_ROADMAP_STATUS,
        server_default=DEFAULT_ROADMAP_STATUS,
        index=True,
    )
    #: Which provider/model produced the content. Recorded for honest display
    #: and debugging; never a credential.
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    #: Optional client-supplied idempotency key. Unique per user so retrying a
    #: generation request returns the original roadmap instead of paying for a
    #: second AI call.
    generation_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    goal: Mapped[Goal] = relationship("Goal", back_populates="roadmaps")
    milestones: Mapped[list[RoadmapMilestone]] = relationship(
        "RoadmapMilestone",
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapMilestone.position",
    )

    @property
    def goal_name(self) -> str:
        return self.goal.name

    @property
    def goal_category(self) -> str:
        return self.goal.category

    @property
    def goal_category_label(self) -> str:
        category = get_category(self.goal.category)
        return category.label if category else self.goal.category

    @property
    def milestone_count(self) -> int:
        return len(self.milestones)

    def __repr__(self) -> str:
        return f"<Roadmap id={self.id} user_id={self.user_id} status={self.status!r}>"


class RoadmapMilestone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One ordered phase of a roadmap."""

    __tablename__ = "roadmap_milestones"
    __table_args__ = (
        UniqueConstraint(
            "roadmap_id",
            "position",
            name="uq_roadmap_milestones_roadmap_position",
        ),
    )

    roadmap_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmaps.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(MILESTONE_TITLE_MAX_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=DEFAULT_ITEM_STATUS,
        server_default=DEFAULT_ITEM_STATUS,
    )

    roadmap: Mapped[Roadmap] = relationship("Roadmap", back_populates="milestones")
    tasks: Mapped[list[RoadmapTask]] = relationship(
        "RoadmapTask",
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="RoadmapTask.position",
    )
    resources: Mapped[list[RoadmapResource]] = relationship(
        "RoadmapResource",
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="RoadmapResource.position",
    )

    def __repr__(self) -> str:
        return (
            f"<RoadmapMilestone id={self.id} roadmap_id={self.roadmap_id} position={self.position}>"
        )


class RoadmapTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One actionable task inside a milestone."""

    __tablename__ = "roadmap_tasks"
    __table_args__ = (
        UniqueConstraint("milestone_id", "position", name="uq_roadmap_tasks_milestone_position"),
    )

    milestone_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_milestones.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(TASK_TITLE_MAX_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=DEFAULT_ITEM_STATUS,
        server_default=DEFAULT_ITEM_STATUS,
    )

    milestone: Mapped[RoadmapMilestone] = relationship("RoadmapMilestone", back_populates="tasks")

    def __repr__(self) -> str:
        return (
            f"<RoadmapTask id={self.id} milestone_id={self.milestone_id} position={self.position}>"
        )


class RoadmapResource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A learning resource recommended for a milestone."""

    __tablename__ = "roadmap_resources"
    __table_args__ = (
        UniqueConstraint(
            "milestone_id",
            "position",
            name="uq_roadmap_resources_milestone_position",
        ),
    )

    milestone_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_milestones.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(RESOURCE_TITLE_MAX_LENGTH), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    url: Mapped[str | None] = mapped_column(String(RESOURCE_URL_MAX_LENGTH), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    milestone: Mapped[RoadmapMilestone] = relationship(
        "RoadmapMilestone", back_populates="resources"
    )

    def __repr__(self) -> str:
        return f"<RoadmapResource id={self.id} milestone_id={self.milestone_id}>"
