"""Schemas for goal categories, goals, and goal assessments.

Assessment answers arrive as a plain mapping because their shape depends on the
goal's category. They are validated against that category's field specification
in :func:`~app.core.goal_categories.validate_assessment_answers`, which is also
what the onboarding UI is generated from — so the API and the form can never
disagree about a question.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.goal_categories import (
    DEFAULT_TEXT_MAX_LENGTH,
    GOAL_CATEGORIES,
    validate_assessment_answers,
)
from app.models.goal import (
    DEFAULT_PRIORITY,
    DEFAULT_STATUS,
    GOAL_AVAILABLE_TIME_MAX_LENGTH,
    GOAL_LONG_TEXT_MAX_LENGTH,
    GOAL_NAME_MAX_LENGTH,
    GOAL_PRIORITIES,
    GOAL_STATUSES,
)

#: Categories offered by ``POST /api/goals`` (a "custom" goal still uses the
#: ``custom`` slug, so this is simply the whole taxonomy).
SUPPORTED_CATEGORY_SLUGS: tuple[str, ...] = tuple(c.slug for c in GOAL_CATEGORIES)


def _clean_optional(value: str | None) -> str | None:
    """Trim an optional string, treating blanks as absent."""
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class AssessmentFieldOut(BaseModel):
    """One onboarding question for a category."""

    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    kind: Literal["text", "textarea", "choice", "multiselect"]
    help_text: str = ""
    required: bool = False
    options: list[str] = Field(default_factory=list)
    #: Longest accepted answer, so client-side validation mirrors the server.
    max_length: int = DEFAULT_TEXT_MAX_LENGTH


class GoalCategoryOut(BaseModel):
    """A supported goal category and the questions asked for it."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    label: str
    description: str
    assessment: list[AssessmentFieldOut] = Field(default_factory=list)


def serialize_categories() -> list[GoalCategoryOut]:
    """Return every canonical category in specification order."""
    return [GoalCategoryOut.model_validate(category) for category in GOAL_CATEGORIES]


class GoalAssessmentOut(BaseModel):
    """Persisted category-specific answers for a goal."""

    model_config = ConfigDict(from_attributes=True)

    answers: dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime


class GoalOut(BaseModel):
    """Public representation of a goal. Never includes internal identifiers."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    category: str
    category_label: str
    motivation: str | None
    current_situation: str | None
    desired_outcome: str | None
    priority: str
    target_date: date | None
    available_time: str | None
    constraints: str | None
    preferences: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    assessment: GoalAssessmentOut | None = None


def _validate_category(value: str) -> str:
    cleaned = value.strip()
    if cleaned not in SUPPORTED_CATEGORY_SLUGS:
        raise ValueError(
            "Unsupported goal category. Use one of: " + ", ".join(SUPPORTED_CATEGORY_SLUGS)
        )
    return cleaned


def _validate_priority(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().lower()
    if cleaned not in GOAL_PRIORITIES:
        raise ValueError(f"Priority must be one of: {', '.join(GOAL_PRIORITIES)}.")
    return cleaned


def _validate_status(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().lower()
    if cleaned not in GOAL_STATUSES:
        raise ValueError(f"Status must be one of: {', '.join(GOAL_STATUSES)}.")
    return cleaned


def _validate_target_date(value: date | None) -> date | None:
    if value is not None and value < date.today():
        raise ValueError("Target date cannot be in the past.")
    return value


class GoalCreate(BaseModel):
    """Payload for creating a goal. ``category`` and ``name`` are mandatory."""

    name: str = Field(min_length=1, max_length=GOAL_NAME_MAX_LENGTH)
    category: str
    description: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    motivation: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    current_situation: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    desired_outcome: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    priority: str = Field(default=DEFAULT_PRIORITY)
    target_date: date | None = None
    available_time: str | None = Field(default=None, max_length=GOAL_AVAILABLE_TIME_MAX_LENGTH)
    constraints: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    preferences: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    status: str = Field(default=DEFAULT_STATUS)
    assessment: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Goal name cannot be empty.")
        return cleaned

    @field_validator("category")
    @classmethod
    def _validate_goal_category(cls, value: str) -> str:
        return _validate_category(value)

    @field_validator("priority")
    @classmethod
    def _validate_priority_field(cls, value: str) -> str:
        return _validate_priority(value) or DEFAULT_PRIORITY

    @field_validator("status")
    @classmethod
    def _validate_status_field(cls, value: str) -> str:
        return _validate_status(value) or DEFAULT_STATUS

    @field_validator("target_date")
    @classmethod
    def _validate_target(cls, value: date | None) -> date | None:
        return _validate_target_date(value)

    @field_validator(
        "description",
        "motivation",
        "current_situation",
        "desired_outcome",
        "constraints",
        "preferences",
        "available_time",
    )
    @classmethod
    def _strip_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)

    @model_validator(mode="after")
    def _validate_assessment(self) -> GoalCreate:
        # Assessment answers are optional at creation time: the onboarding flow
        # creates a goal first (goal-selection step) and adds the category-
        # specific answers in a later step. When answers ARE supplied they are
        # fully validated, including required fields, so a complete submission
        # can never be missing a required answer.
        if self.assessment:
            self.assessment = validate_assessment_answers(self.category, self.assessment)
        return self


class GoalUpdate(BaseModel):
    """Payload for updating a goal. Only fields present in the request change."""

    name: str | None = Field(default=None, max_length=GOAL_NAME_MAX_LENGTH)
    category: str | None = None
    description: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    motivation: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    current_situation: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    desired_outcome: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    priority: str | None = None
    target_date: date | None = None
    available_time: str | None = Field(default=None, max_length=GOAL_AVAILABLE_TIME_MAX_LENGTH)
    constraints: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    preferences: str | None = Field(default=None, max_length=GOAL_LONG_TEXT_MAX_LENGTH)
    status: str | None = None
    assessment: dict[str, Any] | None = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Goal name cannot be empty.")
        return cleaned

    @field_validator("category")
    @classmethod
    def _validate_goal_category(cls, value: str | None) -> str | None:
        return None if value is None else _validate_category(value)

    @field_validator("priority")
    @classmethod
    def _validate_priority_field(cls, value: str | None) -> str | None:
        return _validate_priority(value)

    @field_validator("status")
    @classmethod
    def _validate_status_field(cls, value: str | None) -> str | None:
        return _validate_status(value)

    @field_validator("target_date")
    @classmethod
    def _validate_target(cls, value: date | None) -> date | None:
        return _validate_target_date(value)

    @field_validator(
        "description",
        "motivation",
        "current_situation",
        "desired_outcome",
        "constraints",
        "preferences",
        "available_time",
    )
    @classmethod
    def _strip_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)
