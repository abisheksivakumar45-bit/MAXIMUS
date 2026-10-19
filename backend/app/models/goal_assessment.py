"""Goal assessment model.

Onboarding asks a different set of questions depending on the goal category
(see ``docs/MASTER_SPEC.md`` §4, screen 5). Rather than a wide table with one
column per possible question, each goal gets exactly one assessment row whose
``answers`` map is validated against that category's field specification at the
application layer. PostgreSQL stores the map as ``jsonb``.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.goal import Goal

#: ``jsonb`` on PostgreSQL (indexable, native JSON semantics); plain JSON on the
#: SQLite used by the test suite.
AnswersType = JSON().with_variant(postgresql.JSONB(), "postgresql")


class GoalAssessment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The category-specific onboarding answers for a single goal."""

    __tablename__ = "goal_assessments"
    __table_args__ = (UniqueConstraint("goal_id", name="uq_goal_assessments_goal_id"),)

    goal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Denormalised owner so every read can be scoped to the caller with a single
    # predicate, without joining through goals.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    answers: Mapped[dict[str, Any]] = mapped_column(AnswersType, nullable=False, default=dict)

    goal: Mapped[Goal] = relationship("Goal", back_populates="assessment")

    def __repr__(self) -> str:
        return f"<GoalAssessment id={self.id} goal_id={self.goal_id}>"
