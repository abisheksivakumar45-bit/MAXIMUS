"""Schemas for health and readiness endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Basic service information, available without database access."""

    service: str = Field(description="Service name")
    version: str = Field(description="Application version")
    environment: str = Field(description="Deployment environment label")
    status: str = Field(description="Static service status")
    timestamp: datetime = Field(description="Server time of the response")


class LivenessResponse(BaseModel):
    """Liveness probe payload: the process is running and serving requests."""

    status: str = "alive"


class DatabaseStatus(BaseModel):
    """Database connectivity status."""

    connected: bool = Field(description="Whether a test query succeeded")


class ReadinessResponse(BaseModel):
    """Readiness probe payload: the service can reach its dependencies."""

    status: str = Field(description="'ready' when all critical dependencies are reachable")
    database: DatabaseStatus
