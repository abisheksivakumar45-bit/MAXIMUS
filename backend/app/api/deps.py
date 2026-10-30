"""Shared FastAPI dependencies: authentication, session cookies, rate limiting."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.ai.factory import build_provider
from app.ai.provider import AIProvider
from app.core.config import Settings, get_settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.db.session import get_session
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.goal_service import GoalService
from app.services.onboarding_service import OnboardingService
from app.services.roadmap_service import RoadmapService


def get_app_settings(request: Request) -> Settings:
    """Return the settings the application was built with.

    ``create_app(settings)`` stores its instance on ``app.state`` so tests and
    custom deployments can build an app with different settings without
    mutating the process-wide cache.
    """
    runtime_settings: Settings | None = getattr(request.app.state, "settings", None)
    return runtime_settings or get_settings()


def get_auth_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    """Build the authentication service for the current request."""
    return AuthService(session, settings)


def get_goal_service(session: Session = Depends(get_session)) -> GoalService:
    """Build the goal service for the current request."""
    return GoalService(session)


def get_onboarding_service(session: Session = Depends(get_session)) -> OnboardingService:
    """Build the onboarding service for the current request."""
    return OnboardingService(session)


def get_ai_provider(settings: Settings = Depends(get_app_settings)) -> AIProvider:
    """Build the configured AI provider for the current request."""
    return build_provider(settings)


def get_roadmap_service(
    session: Session = Depends(get_session),
    provider: AIProvider = Depends(get_ai_provider),
) -> RoadmapService:
    """Build the roadmap service for the current request."""
    return RoadmapService(session, provider)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Cookie"},
    )


def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the authenticated user from the session cookie.

    The identity is always derived from the validated server-side session —
    never from a client-supplied user id.
    """
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise _unauthorized()
    user = auth_service.resolve_session(token)
    if user is None:
        raise _unauthorized()
    return user


def rate_limit_scope(scope: str) -> Callable[..., None]:
    """Return a dependency that rate limits requests per client IP for ``scope``."""

    def dependency(request: Request) -> None:
        limiter: SlidingWindowRateLimiter | None = getattr(
            request.app.state, "auth_rate_limiter", None
        )
        if limiter is None:  # pragma: no cover - defensive; always configured
            return
        client_host = request.client.host if request.client else "unknown"
        allowed, retry_after = limiter.check(f"{scope}:{client_host}")
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency


def roadmap_generation_rate_limit(
    request: Request,
    user: User = Depends(get_current_user),
) -> None:
    """Limit expensive roadmap generation per authenticated user.

    The generation endpoint is the only endpoint that can trigger a paid
    provider call, so it gets its own limiter rather than sharing the auth one.
    """
    limiter: SlidingWindowRateLimiter | None = getattr(
        request.app.state, "roadmap_rate_limiter", None
    )
    if limiter is None:  # pragma: no cover - defensive; always configured
        return
    allowed, retry_after = limiter.check(f"roadmap-generate:{user.id}")
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many roadmap generation attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def set_session_cookie(response: Response, *, token: str, settings: Settings) -> None:
    """Attach the HttpOnly session cookie to a response."""
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_lifetime_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response, *, settings: Settings) -> None:
    """Remove the session cookie from the browser."""
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
