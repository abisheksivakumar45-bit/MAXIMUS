"""MAXIMUS FastAPI application factory."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.api.routes import health
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging

logger = logging.getLogger(__name__)


async def _log_requests(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Minimal request/response logging middleware (no payload contents)."""
    logger.info("%s %s", request.method, request.url.path)
    response = await call_next(request)
    return response


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI application."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "MAXIMUS — AI-powered personal growth and life-management platform. "
            "Phase 1 (foundation): service shell, health endpoints, and database migrations."
        ),
        docs_url="/api/docs" if settings.app_env != "production" else None,
        redoc_url=None,
    )

    # Strict CORS: only explicitly configured browser origins are allowed.
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    application.middleware("http")(_log_requests)

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Return a safe error body; log the full traceback server-side only."""
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    application.include_router(health.router, prefix=settings.api_v1_prefix)

    @application.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "docs": "/api/docs",
            "health": f"{settings.api_v1_prefix}/health",
        }

    logger.info(
        "MAXIMUS backend initialised (env=%s, version=%s)", settings.app_env, settings.app_version
    )
    return application


app = create_app()
