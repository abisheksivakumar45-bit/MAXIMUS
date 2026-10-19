"""Goal-management endpoints.

Every route resolves the owner from the validated session cookie, and the
repository scopes all statements to that user — so a goal id belonging to
someone else is indistinguishable from one that does not exist.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_goal_service
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import (
    GoalCategoryOut,
    GoalCreate,
    GoalOut,
    GoalUpdate,
    serialize_categories,
)
from app.services.goal_service import (
    DuplicateGoalError,
    GoalNotFoundError,
    GoalService,
    InvalidAssessmentError,
)

router = APIRouter(prefix="/goals", tags=["goals"])


def _goal_not_found() -> HTTPException:
    # Deliberately identical whether the goal never existed or belongs to
    # another user, so ids cannot be probed for existence.
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")


def _invalid_assessment(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))


@router.get(
    "/categories",
    response_model=list[GoalCategoryOut],
    summary="List the supported goal categories",
)
def list_categories() -> list[GoalCategoryOut]:
    """Reference data: the canonical categories and their onboarding questions."""
    return serialize_categories()


@router.get("", response_model=list[GoalOut], summary="List the current user's goals")
def list_goals(
    user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> list[Goal]:
    return goal_service.list_goals(user.id)


@router.post(
    "",
    response_model=GoalOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a goal for the current user",
)
def create_goal(
    payload: GoalCreate,
    user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> Goal:
    try:
        return goal_service.create_goal(user.id, payload)
    except DuplicateGoalError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidAssessmentError as exc:
        raise _invalid_assessment(exc) from exc


@router.get("/{goal_id}", response_model=GoalOut, summary="Get one of the current user's goals")
def get_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> Goal:
    try:
        return goal_service.get_goal(user.id, goal_id)
    except GoalNotFoundError as exc:
        raise _goal_not_found() from exc


@router.patch("/{goal_id}", response_model=GoalOut, summary="Update a goal and its assessment")
def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> Goal:
    try:
        return goal_service.update_goal(user.id, goal_id, payload)
    except GoalNotFoundError as exc:
        raise _goal_not_found() from exc
    except DuplicateGoalError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidAssessmentError as exc:
        raise _invalid_assessment(exc) from exc


@router.delete(
    "/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one of the current user's goals",
)
def delete_goal(
    goal_id: uuid.UUID,
    user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> None:
    try:
        goal_service.delete_goal(user.id, goal_id)
    except GoalNotFoundError as exc:
        raise _goal_not_found() from exc
