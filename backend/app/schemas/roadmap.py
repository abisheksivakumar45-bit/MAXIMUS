"""Schemas for roadmap generation, listing, and detail views."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

#: Idempotency keys are opaque to the backend. Restrict the alphabet so they
#: cannot be used to smuggle large or surprising strings into storage/logs.
IDEMPOTENCY_KEY_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"


class RoadmapGenerateRequest(BaseModel):
    """Request to generate a roadmap for one of the user's goals."""

    goal_id: uuid.UUID
    #: Optional. Reusing the same key (for example when retrying after a
    #: network error) returns the already-generated roadmap and never calls the
    #: AI provider twice.
    idempotency_key: str | None = Field(
        default=None,
        pattern=IDEMPOTENCY_KEY_PATTERN,
        description="Opaque retry key, 8-64 characters of A-Z, a-z, 0-9, _ or -.",
    )


class RoadmapTaskOut(BaseModel):
    """One task inside a milestone."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    title: str
    description: str
    estimated_minutes: int | None
    completion_criteria: str | None
    status: str


class RoadmapResourceOut(BaseModel):
    """One resource recommendation attached to a milestone."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    title: str
    resource_type: str
    url: str | None
    note: str | None


class RoadmapMilestoneOut(BaseModel):
    """An ordered phase with its tasks and resources."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    title: str
    description: str
    estimated_duration_weeks: int
    completion_criteria: str
    status: str
    tasks: list[RoadmapTaskOut] = Field(default_factory=list)
    resources: list[RoadmapResourceOut] = Field(default_factory=list)


class RoadmapSummaryOut(BaseModel):
    """List-view representation (no nested tasks or resources)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    goal_name: str
    goal_category: str
    goal_category_label: str
    title: str
    status: str
    estimated_duration_weeks: int
    milestone_count: int
    provider: str
    model: str
    approved_at: datetime | None
    created_at: datetime


class RoadmapOut(BaseModel):
    """Full roadmap detail, including every milestone, task, and resource."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    goal_name: str
    goal_category: str
    goal_category_label: str
    title: str
    description: str
    objective: str
    starting_level: str
    target_level: str
    estimated_duration_weeks: int
    status: str
    provider: str
    model: str
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    milestones: list[RoadmapMilestoneOut] = Field(default_factory=list)


class AIConfigStatusOut(BaseModel):
    """Whether roadmap generation can run, safe to expose to the browser."""

    configured: bool
    provider: str
    model: str | None
    message: str
