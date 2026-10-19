"""Goal business logic.

Routes stay thin: they translate these outcomes into HTTP responses. All reads
and writes go through :class:`~app.repositories.goal_repository.GoalRepository`,
which scopes every statement to the owning user, so one user can never reach
another user's goal.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.goal_categories import validate_assessment_answers
from app.models.goal import Goal
from app.repositories.goal_repository import GoalRepository
from app.schemas.goal import GoalCreate, GoalUpdate


class GoalError(Exception):
    """Base class for goal failures."""


class GoalNotFoundError(GoalError):
    """Raised when a goal does not exist or belongs to another user."""


class DuplicateGoalError(GoalError):
    """Raised when the user already has a goal with that name and category."""


class InvalidAssessmentError(GoalError):
    """Raised when assessment answers do not satisfy the category specification."""


class GoalService:
    """Coordinates goal and assessment operations for one user."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._goals = GoalRepository(session)

    # -- reads ---------------------------------------------------------------
    def list_goals(self, user_id: uuid.UUID) -> list[Goal]:
        return self._goals.list_for_user(user_id)

    def get_goal(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> Goal:
        goal = self._goals.get_for_user(user_id, goal_id)
        if goal is None:
            raise GoalNotFoundError
        return goal

    # -- writes --------------------------------------------------------------
    def create_goal(self, user_id: uuid.UUID, payload: GoalCreate) -> Goal:
        if self._goals.name_taken(user_id=user_id, category=payload.category, name=payload.name):
            raise DuplicateGoalError("You already have a goal with this name in this category.")

        assessment = dict(payload.assessment) if payload.assessment else None
        goal = self._goals.create(
            user_id=user_id,
            name=payload.name,
            category=payload.category,
            description=payload.description,
            motivation=payload.motivation,
            current_situation=payload.current_situation,
            desired_outcome=payload.desired_outcome,
            priority=payload.priority,
            target_date=payload.target_date,
            available_time=payload.available_time,
            constraints=payload.constraints,
            preferences=payload.preferences,
            status=payload.status,
            assessment_answers=assessment,
        )
        # Commit like every other write path: the request-scoped session is
        # closed (and its transaction rolled back) at the end of the request.
        self._session.commit()
        return goal

    def update_goal(self, user_id: uuid.UUID, goal_id: uuid.UUID, payload: GoalUpdate) -> Goal:
        goal = self.get_goal(user_id, goal_id)
        changes = payload.model_dump(exclude_unset=True)
        assessment_answers = changes.pop("assessment", None)
        final_category = changes.get("category", goal.category)

        if "name" in changes or "category" in changes:
            if self._goals.name_taken(
                user_id=user_id,
                category=final_category,
                name=changes.get("name", goal.name),
                exclude_goal_id=goal.id,
            ):
                raise DuplicateGoalError("You already have a goal with this name in this category.")

        for field_name, value in changes.items():
            setattr(goal, field_name, value)

        if assessment_answers is not None:
            self._set_assessment(goal, final_category, dict(assessment_answers))

        self._session.commit()
        return goal

    def delete_goal(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> None:
        goal = self.get_goal(user_id, goal_id)
        self._goals.delete(goal)
        self._session.commit()

    # -- internals -----------------------------------------------------------
    def _set_assessment(self, goal: Goal, category: str, answers: dict[str, object]) -> None:
        """Merge the provided answers into the stored ones and persist them."""
        merged = dict(goal.assessment.answers) if goal.assessment is not None else {}
        merged.update(answers)
        try:
            validated = validate_assessment_answers(category, merged)
        except ValueError as exc:
            raise InvalidAssessmentError(str(exc)) from exc
        self._goals.set_assessment(goal, validated)
