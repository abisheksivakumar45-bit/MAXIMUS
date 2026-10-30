"""Roadmap generation, listing, detail, and approval endpoints.

Every route resolves the owner from the validated session cookie. The
repository scopes each statement to that user, so another user's roadmap id is
indistinguishable from one that does not exist. Generation is the only endpoint
that can call an external AI provider; it is rate limited and never runs when
the backend has no provider configured.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.ai.factory import describe_provider
from app.ai.prompts import PromptTooLargeError
from app.ai.provider import (
    AIConfigurationError,
    AIRateLimitError,
    AIRequestError,
    AIResponseError,
    AITimeoutError,
)
from app.api.deps import (
    get_app_settings,
    get_current_user,
    get_roadmap_service,
    roadmap_generation_rate_limit,
)
from app.core.config import Settings
from app.models.roadmap import Roadmap
from app.models.user import User
from app.schemas.roadmap import (
    AIConfigStatusOut,
    RoadmapGenerateRequest,
    RoadmapOut,
    RoadmapSummaryOut,
)
from app.services.goal_service import GoalNotFoundError
from app.services.roadmap_service import (
    GenerationInProgressError,
    GoalNotEligibleError,
    IdempotencyConflictError,
    RoadmapNotFoundError,
    RoadmapService,
)

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


def _roadmap_not_found() -> HTTPException:
    # Identical for "never existed" and "belongs to someone else".
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roadmap not found.")


def _ai_http_error(exc: Exception) -> HTTPException:
    """Translate a provider failure into a safe, honest HTTP response."""
    if isinstance(exc, AIConfigurationError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, AITimeoutError):
        return HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI provider timed out. No roadmap was saved. Please try again.",
        )
    if isinstance(exc, AIRateLimitError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The AI provider is rate limiting requests. No roadmap was saved. "
                "Please try again shortly."
            ),
            headers={"Retry-After": "30"},
        )
    if isinstance(exc, AIResponseError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The AI provider returned an invalid roadmap. No roadmap was saved. "
                "Please try again."
            ),
        )
    if isinstance(exc, AIRequestError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider could not be reached. No roadmap was saved. Please try again.",
        )
    # Defensive: callers only pass the AI exceptions above.
    return HTTPException(  # pragma: no cover
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AI generation failed. No roadmap was saved.",
    )


@router.get(
    "/config",
    response_model=AIConfigStatusOut,
    summary="Report whether AI roadmap generation is configured",
)
def get_ai_config(settings: Settings = Depends(get_app_settings)) -> AIConfigStatusOut:
    """Return non-sensitive provider status (never the API key)."""
    provider_status = describe_provider(settings)
    return AIConfigStatusOut(
        configured=provider_status.configured,
        provider=provider_status.provider,
        model=provider_status.model,
        message=provider_status.message,
    )


@router.get("", response_model=list[RoadmapSummaryOut], summary="List the current user's roadmaps")
def list_roadmaps(
    user: User = Depends(get_current_user),
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> list[Roadmap]:
    return roadmap_service.list_roadmaps(user.id)


@router.post(
    "/generate",
    response_model=RoadmapOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate and persist a roadmap for one of the user's goals",
)
def generate_roadmap(
    payload: RoadmapGenerateRequest,
    response: Response,
    user: User = Depends(get_current_user),
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
    _rate_limit: None = Depends(roadmap_generation_rate_limit),
) -> Roadmap:
    try:
        roadmap, created = roadmap_service.generate(user, payload)
    except GoalNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found."
        ) from exc
    except GoalNotEligibleError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except GenerationInProgressError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except PromptTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    except (AIConfigurationError, AIRateLimitError, AIRequestError, AIResponseError) as exc:
        raise _ai_http_error(exc) from exc

    if not created:
        response.status_code = status.HTTP_200_OK
    return roadmap


@router.get("/{roadmap_id}", response_model=RoadmapOut, summary="Get one of the user's roadmaps")
def get_roadmap(
    roadmap_id: uuid.UUID,
    user: User = Depends(get_current_user),
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Roadmap:
    try:
        return roadmap_service.get_roadmap(user.id, roadmap_id)
    except RoadmapNotFoundError as exc:
        raise _roadmap_not_found() from exc


@router.post(
    "/{roadmap_id}/approve",
    response_model=RoadmapOut,
    summary="Approve a roadmap as the active plan for its goal",
)
def approve_roadmap(
    roadmap_id: uuid.UUID,
    user: User = Depends(get_current_user),
    roadmap_service: RoadmapService = Depends(get_roadmap_service),
) -> Roadmap:
    try:
        return roadmap_service.approve(user.id, roadmap_id)
    except RoadmapNotFoundError as exc:
        raise _roadmap_not_found() from exc
