"""Onboarding endpoints.

Onboarding progress is resumable: each save is a partial merge, so an
interrupted run continues where it stopped. The row is only marked complete
once the server-side requirements are met — the client's ``completed`` flag is
a request, never an authority.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_onboarding_service
from app.models.user import User
from app.models.user_onboarding import UserOnboarding
from app.schemas.onboarding import (
    OnboardingLifestyleOut,
    OnboardingOut,
    OnboardingProfileOut,
    OnboardingSave,
    onboarding_options,
)
from app.services.onboarding_service import (
    OnboardingIncompleteError,
    OnboardingService,
    describe_missing,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _to_out(row: UserOnboarding | None, missing: list[str]) -> OnboardingOut:
    """Build the public onboarding response, tolerating a first-time user."""
    if row is None:
        return OnboardingOut(
            options=onboarding_options(),
            missing=missing,
        )
    return OnboardingOut(
        completed_at=row.completed_at,
        current_step=row.current_step,
        profile=OnboardingProfileOut.model_validate(row),
        lifestyle=OnboardingLifestyleOut.model_validate(row),
        options=onboarding_options(),
        missing=missing,
    )


@router.get("", response_model=OnboardingOut, summary="Get the current user's onboarding state")
def get_onboarding(
    user: User = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
) -> OnboardingOut:
    row, missing = onboarding_service.get_status(user)
    return _to_out(row, missing)


@router.put("", response_model=OnboardingOut, summary="Save onboarding progress")
def save_onboarding(
    payload: OnboardingSave,
    user: User = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
) -> OnboardingOut:
    try:
        row, missing = onboarding_service.save(user, payload)
    except OnboardingIncompleteError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=describe_missing(exc.missing),
        ) from exc
    return _to_out(row, missing)
