"""Database access for goals and their assessments.

Every read is scoped to a user id. There is deliberately no "get by id alone"
helper: a goal can only ever be reached through its owner, which is how
cross-user access is prevented at the data-access layer rather than relying on
callers to remember a filter.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.goal import Goal
from app.models.goal_assessment import GoalAssessment


class GoalRepository:
    """Persistence operations for :class:`~app.models.goal.Goal`."""

    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _with_assessment(statement: Select[tuple[Goal]]) -> Select[tuple[Goal]]:
        return statement.options(selectinload(Goal.assessment))

    def list_for_user(self, user_id: uuid.UUID) -> list[Goal]:
        statement = (
            self._with_assessment(select(Goal))
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.asc(), Goal.id.asc())
        )
        return list(self._session.execute(statement).scalars())

    def get_for_user(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> Goal | None:
        statement = self._with_assessment(select(Goal)).where(
            Goal.user_id == user_id,
            Goal.id == goal_id,
        )
        return self._session.execute(statement).scalar_one_or_none()

    def count_for_user(self, user_id: uuid.UUID) -> int:
        statement = select(func.count()).select_from(Goal).where(Goal.user_id == user_id)
        return int(self._session.execute(statement).scalar_one())

    def activate_drafts(self, user_id: uuid.UUID) -> int:
        """Promote every draft goal to active. Returns the number of rows changed.

        Used when onboarding is completed: the review step is the approval
        point, so the goals drafted during onboarding become the user's active
        goals in the same transaction that records completion.
        """
        statement = (
            update(Goal)
            .where(Goal.user_id == user_id, Goal.status == "draft")
            .values(status="active", updated_at=func.now())
        )
        result = self._session.execute(statement)
        self._session.flush()
        return int(result.rowcount or 0)

    def name_taken(
        self,
        *,
        user_id: uuid.UUID,
        category: str,
        name: str,
        exclude_goal_id: uuid.UUID | None = None,
    ) -> bool:
        """True when the user already has a goal with this name in this category."""
        statement = select(Goal.id).where(
            Goal.user_id == user_id,
            Goal.category == category,
            Goal.name == name,
        )
        if exclude_goal_id is not None:
            statement = statement.where(Goal.id != exclude_goal_id)
        return self._session.execute(statement.limit(1)).scalar_one_or_none() is not None

    def create(
        self, *, user_id: uuid.UUID, assessment_answers: dict[str, Any] | None = None, **fields: Any
    ) -> Goal:
        goal = Goal(user_id=user_id, **fields)
        self._session.add(goal)
        self._session.flush()
        if assessment_answers is not None:
            self._set_assessment(goal, assessment_answers)
        self._session.flush()
        return goal

    def _set_assessment(self, goal: Goal, answers: dict[str, Any]) -> GoalAssessment:
        assessment = goal.assessment
        if assessment is None:
            assessment = GoalAssessment(goal_id=goal.id, user_id=goal.user_id, answers=answers)
            self._session.add(assessment)
            goal.assessment = assessment
        else:
            assessment.answers = answers
        self._session.flush()
        return assessment

    def set_assessment(self, goal: Goal, answers: dict[str, Any]) -> GoalAssessment:
        """Create or replace the goal's assessment answers."""
        return self._set_assessment(goal, answers)

    def delete(self, goal: Goal) -> None:
        """Remove a goal; its assessment is removed by the cascade."""
        self._session.delete(goal)
        self._session.flush()
