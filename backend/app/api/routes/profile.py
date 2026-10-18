"""User profile endpoints.

A user can only ever read or modify their *own* profile: the account is
resolved from the validated session cookie, and no user id is accepted from
the client.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_auth_service, get_current_user
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserPublic
from app.services.auth_service import AuthService

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=UserPublic, summary="Get the current user's profile")
def get_profile(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("", response_model=UserPublic, summary="Update the current user's profile")
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    return auth_service.update_profile(user, display_name=payload.display_name)
