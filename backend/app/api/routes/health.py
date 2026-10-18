"""Health and readiness endpoints.

These endpoints require no authentication and expose no user data.
They support container orchestration health checks and honest status
reporting in the frontend shell.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.schemas.health import (
    DatabaseStatus,
    HealthResponse,
    LivenessResponse,
    ReadinessResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Basic service information. Does not touch the database."""
    return HealthResponse(
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        status="ok",
        timestamp=datetime.now(UTC),
    )


@router.get("/health/live", response_model=LivenessResponse)
def get_liveness() -> LivenessResponse:
    """Liveness probe: the process is running and serving requests."""
    return LivenessResponse()


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Database unreachable"}},
)
def get_readiness(session: Session = Depends(get_session)) -> ReadinessResponse:
    """Readiness probe: verifies the database is reachable and queryable.

    Returns HTTP 503 when the database is unreachable so that container
    orchestrators and load balancers can detect the degraded state.
    """
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.warning("Readiness check failed: database unreachable: %s", exc.__class__.__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unreachable",
        ) from exc
    return ReadinessResponse(status="ready", database=DatabaseStatus(connected=True))
