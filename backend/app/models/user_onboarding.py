"""Onboarding progress model.

Holds the answers to the two user-level onboarding screens (basic profile and
lifestyle, ``docs/MASTER_SPEC.md`` §4 screens 2 and 3) plus enough state to
resume an interrupted onboarding run. Goal selection is *not* duplicated here:
the user's goals are the source of truth, and
``completed_at`` is only set once every required answer is present.

Each user has at most one row.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

#: Which onboarding step the user was last on (used to resume).
ONBOARDING_STEPS = (
    "welcome",
    "profile",
    "lifestyle",
    "goals",
    "assessment",
    "review",
)

EquipmentType = JSON().with_variant(postgresql.JSONB(), "postgresql")


class UserOnboarding(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-user onboarding answers and completion state."""

    __tablename__ = "user_onboarding"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    # --- Screen 2: basic profile -------------------------------------------
    age_range: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    wake_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    bedtime: Mapped[str | None] = mapped_column(String(5), nullable=True)
    daily_availability: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # --- Screen 3: lifestyle ------------------------------------------------
    schedule: Mapped[str | None] = mapped_column(String(64), nullable=True)
    study_hours_per_day: Mapped[str | None] = mapped_column(String(32), nullable=True)
    food_budget: Mapped[str | None] = mapped_column(String(32), nullable=True)
    food_preferences: Mapped[str | None] = mapped_column(String(255), nullable=True)
    exercise_experience: Mapped[str | None] = mapped_column(String(32), nullable=True)
    equipment: Mapped[list[str] | None] = mapped_column(EquipmentType, nullable=True)
    existing_routines: Mapped[str | None] = mapped_column(String(255), nullable=True)
    planning_style: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # --- Resume / completion ------------------------------------------------
    current_step: Mapped[str | None] = mapped_column(String(32), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<UserOnboarding id={self.id} user_id={self.user_id}>"
