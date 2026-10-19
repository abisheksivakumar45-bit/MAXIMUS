"""Goal model.

A goal belongs to exactly one user and is the ownership root for everything
Phase 4+ attaches to it (roadmaps, milestones, weekly objectives, daily tasks,
progress history). Those tables do not exist yet; they will reference
``goals.id`` with ``ON DELETE CASCADE``.

Only attributes shared by *every* goal live here (name, motivation, priority,
...). Category-specific onboarding answers live on
:class:`~app.models.goal_assessment.GoalAssessment`.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.goal_categories import get_category
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.goal_assessment import GoalAssessment

GOAL_NAME_MAX_LENGTH = 120
GOAL_AVAILABLE_TIME_MAX_LENGTH = 120
GOAL_LONG_TEXT_MAX_LENGTH = 2000

GOAL_PRIORITIES = ("low", "medium", "high")
GOAL_STATUSES = ("draft", "active", "paused", "completed", "archived")

DEFAULT_PRIORITY = "medium"
DEFAULT_STATUS = "draft"


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single goal owned by one user."""

    __tablename__ = "goals"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category",
            "name",
            name="uq_goals_user_category_name",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(GOAL_NAME_MAX_LENGTH), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(64),
        # Validated in the application layer against the canonical taxonomy;
        # a CHECK constraint would duplicate that list and drift from it.
        nullable=False,
        index=True,
    )
    motivation: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_situation: Mapped[str | None] = mapped_column(Text, nullable=True)
    desired_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=DEFAULT_PRIORITY,
        server_default=DEFAULT_PRIORITY,
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    available_time: Mapped[str | None] = mapped_column(
        String(GOAL_AVAILABLE_TIME_MAX_LENGTH), nullable=True
    )
    constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=DEFAULT_STATUS,
        server_default=DEFAULT_STATUS,
        index=True,
    )

    assessment: Mapped[GoalAssessment | None] = relationship(
        "GoalAssessment",
        back_populates="goal",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def category_label(self) -> str:
        """Human-readable category label (falls back to the raw slug)."""
        category = get_category(self.category)
        return category.label if category else self.category

    def __repr__(self) -> str:
        return f"<Goal id={self.id} user_id={self.user_id} category={self.category!r}>"
