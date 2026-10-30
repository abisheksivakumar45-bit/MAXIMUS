"""The strict contract an AI provider must satisfy for roadmap generation.

This is deliberately separate from the API/ORM schemas: it describes *what a
model may return*, and every field is bounded. ``extra="forbid"`` means a model
cannot smuggle in unexpected keys, and the size limits guarantee one generation
can never produce an unbounded amount of text. Anything that fails validation
is rejected before it can reach the database.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: Bounds mirrored by the prompt. Kept here so validation and documentation
#: cannot drift apart.
MAX_MILESTONES = 12
MAX_TASKS_PER_MILESTONE = 12
MAX_RESOURCES_PER_MILESTONE = 5

ResourceType = Literal["book", "course", "video", "article", "practice", "tool", "other"]


class _StrictModel(BaseModel):
    """Shared configuration: reject unknown keys, trim strings, forbid blanks."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class GeneratedResource(_StrictModel):
    """A learning resource or recommendation attached to a milestone."""

    title: str = Field(min_length=1, max_length=200)
    resource_type: ResourceType
    url: str | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, max_length=300)

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith(("http://", "https://")):
            raise ValueError("Resource URLs must use http or https.")
        return value

    @field_validator("note")
    @classmethod
    def _blank_note_is_absent(cls, value: str | None) -> str | None:
        return value or None


class GeneratedTask(_StrictModel):
    """One actionable task inside a milestone."""

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=1000)
    estimated_minutes: int = Field(ge=5, le=600)
    completion_criteria: str = Field(min_length=1, max_length=300)


class GeneratedMilestone(_StrictModel):
    """An ordered phase of the roadmap."""

    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=1000)
    estimated_duration_weeks: int = Field(ge=1, le=52)
    completion_criteria: str = Field(min_length=1, max_length=500)
    tasks: list[GeneratedTask] = Field(min_length=1, max_length=MAX_TASKS_PER_MILESTONE)
    resources: list[GeneratedResource] = Field(
        default_factory=list, max_length=MAX_RESOURCES_PER_MILESTONE
    )


class GeneratedRoadmap(_StrictModel):
    """The complete structured roadmap returned by the provider."""

    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)
    objective: str = Field(min_length=1, max_length=1000)
    starting_level: str = Field(min_length=1, max_length=120)
    target_level: str = Field(min_length=1, max_length=120)
    estimated_duration_weeks: int = Field(ge=1, le=260)
    milestones: list[GeneratedMilestone] = Field(min_length=1, max_length=MAX_MILESTONES)
