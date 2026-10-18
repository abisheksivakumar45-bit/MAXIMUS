"""Authentication endpoints: register, login, logout, and current user.

All authentication is cookie-based and server-managed. Registration and login
issue an HttpOnly session cookie; the response body carries only the public
user record (never a token or password hash).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import (
    clear_session_cookie,
    get_auth_service,
    get_current_user,
    rate_limit_scope,
    set_session_cookie,
)
from app.core.config import Settings, get_settings
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.user import UserPublic
from app.services.auth_service import (
    AuthService,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_scope("register"))],
    summary="Create a new account and start a session",
)
def register(
    payload: RegisterRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    try:
        user, token = auth_service.register(
            display_name=payload.display_name,
            email=str(payload.email),
            password=payload.password,
        )
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    set_session_cookie(response, token=token, settings=settings)
    return user


@router.post(
    "/login",
    response_model=UserPublic,
    dependencies=[Depends(rate_limit_scope("login"))],
    summary="Authenticate an existing account",
)
def login(
    payload: LoginRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    try:
        user, token = auth_service.login(email=str(payload.email), password=payload.password)
    except InvalidCredentialsError as exc:
        # Deliberately generic: never reveal whether the email exists.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        ) from exc

    set_session_cookie(response, token=token, settings=settings)
    return user


@router.post("/logout", summary="Revoke the current session")
def logout(
    request: Request,
    response: Response,
    settings: Settings = Depends(get_settings),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        auth_service.logout(token)
    clear_session_cookie(response, settings=settings)
    return {"detail": "Logged out"}


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Return the currently authenticated user",
)
def read_current_user(user: User = Depends(get_current_user)) -> User:
    return user
