"""Schemas for onboarding progress (basic profile, lifestyle, completion).

The accepted values for the choice-like fields are exposed to the client as
part of ``GET /api/onboarding`` so the form always renders exactly what the
backend accepts. Where an onboarding answer is the same question asked by a
goal category (weekly budget, exercise equipment) the options are reused from
that category rather than redefined.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.goal_categories import get_category

#: ``HH:MM`` on a 24-hour clock.
TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

AGE_RANGES = ("18-24", "25-34", "35-44", "45-54", "55+", "Prefer not to say")
DAILY_AVAILABILITY = ("Under 1 hour", "1-2 hours", "2-4 hours", "4+ hours")
WORK_STUDY_SCHEDULE = (
    "Full-time work",
    "Part-time work",
    "Student",
    "Both work and study",
    "Not currently working or studying",
    "Other",
)
STUDY_HOURS = ("None", "Under 1 hour", "1-2 hours", "2-4 hours", "4+ hours")
EXPERIENCE_LEVELS = ("Never trained", "Beginner", "Intermediate", "Advanced")
PLANNING_STYLES = (
    "Detailed hour-by-hour plan",
    "Flexible time blocks",
    "A simple list of priorities",
    "Not sure yet",
)

TIMEZONE_MAX_LENGTH = 64
LANGUAGE_MAX_LENGTH = 32
FREE_TEXT_MAX_LENGTH = 255


def _options_from_goal_category(slug: str, key: str) -> tuple[str, ...]:
    """Reuse a goal category's answer options for the matching onboarding field."""
    category = get_category(slug)
    if category is None:
        return ()
    for spec in category.assessment:
        if spec.key == key:
            return spec.options
    return ()


FOOD_BUDGET_OPTIONS = _options_from_goal_category("healthy-weight-nutrition", "weekly_budget")
EQUIPMENT_OPTIONS = _options_from_goal_category("strength-fitness", "equipment")


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _choice(value: str | None, options: Sequence[str], label: str) -> str | None:
    cleaned = _clean_optional(value)
    if cleaned is None:
        return None
    if cleaned not in options:
        raise ValueError(f"{label} must be one of: {', '.join(options)}.")
    return cleaned


def _time_of_day(value: str | None, label: str) -> str | None:
    cleaned = _clean_optional(value)
    if cleaned is None:
        return None
    if not TIME_PATTERN.fullmatch(cleaned):
        raise ValueError(f"{label} must be a 24-hour time such as 07:30.")
    return cleaned


class OnboardingProfileIn(BaseModel):
    """Answers to onboarding screen 2 (basic profile)."""

    age_range: str | None = None
    timezone: str | None = None
    preferred_language: str | None = None
    wake_time: str | None = None
    bedtime: str | None = None
    daily_availability: str | None = None

    @field_validator("age_range")
    @classmethod
    def _validate_age_range(cls, value: str | None) -> str | None:
        return _choice(value, AGE_RANGES, "Age range")

    @field_validator("daily_availability")
    @classmethod
    def _validate_daily_availability(cls, value: str | None) -> str | None:
        return _choice(value, DAILY_AVAILABILITY, "Daily availability")

    @field_validator("wake_time")
    @classmethod
    def _validate_wake_time(cls, value: str | None) -> str | None:
        return _time_of_day(value, "Wake-up time")

    @field_validator("bedtime")
    @classmethod
    def _validate_bedtime(cls, value: str | None) -> str | None:
        return _time_of_day(value, "Bedtime")

    @field_validator("timezone")
    @classmethod
    def _validate_timezone(cls, value: str | None) -> str | None:
        cleaned = _clean_optional(value)
        if cleaned is not None and len(cleaned) > TIMEZONE_MAX_LENGTH:
            raise ValueError(f"Time zone must be {TIMEZONE_MAX_LENGTH} characters or fewer.")
        return cleaned

    @field_validator("preferred_language")
    @classmethod
    def _validate_language(cls, value: str | None) -> str | None:
        cleaned = _clean_optional(value)
        if cleaned is not None and len(cleaned) > LANGUAGE_MAX_LENGTH:
            raise ValueError(
                f"Preferred language must be {LANGUAGE_MAX_LENGTH} characters or fewer."
            )
        return cleaned


class OnboardingLifestyleIn(BaseModel):
    """Answers to onboarding screen 3 (lifestyle)."""

    schedule: str | None = None
    study_hours_per_day: str | None = None
    food_budget: str | None = None
    food_preferences: str | None = None
    exercise_experience: str | None = None
    equipment: list[str] | None = None
    existing_routines: str | None = None
    planning_style: str | None = None

    @field_validator("schedule")
    @classmethod
    def _validate_schedule(cls, value: str | None) -> str | None:
        return _choice(value, WORK_STUDY_SCHEDULE, "College or work schedule")

    @field_validator("study_hours_per_day")
    @classmethod
    def _validate_study_hours(cls, value: str | None) -> str | None:
        return _choice(value, STUDY_HOURS, "Study hours")

    @field_validator("food_budget")
    @classmethod
    def _validate_food_budget(cls, value: str | None) -> str | None:
        return _choice(value, FOOD_BUDGET_OPTIONS, "Food budget")

    @field_validator("exercise_experience")
    @classmethod
    def _validate_exercise_experience(cls, value: str | None) -> str | None:
        return _choice(value, EXPERIENCE_LEVELS, "Exercise experience")

    @field_validator("planning_style")
    @classmethod
    def _validate_planning_style(cls, value: str | None) -> str | None:
        return _choice(value, PLANNING_STYLES, "Planning style")

    @field_validator("equipment")
    @classmethod
    def _validate_equipment(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [item.strip() for item in value if item.strip()]
        for item in cleaned:
            if item not in EQUIPMENT_OPTIONS:
                raise ValueError(f"Equipment contains an unknown choice: {item}.")
        return cleaned

    @field_validator("food_preferences", "existing_routines")
    @classmethod
    def _validate_free_text(cls, value: str | None) -> str | None:
        cleaned = _clean_optional(value)
        if cleaned is not None and len(cleaned) > FREE_TEXT_MAX_LENGTH:
            raise ValueError(f"This answer must be {FREE_TEXT_MAX_LENGTH} characters or fewer.")
        return cleaned


class OnboardingSave(BaseModel):
    """Partial save of onboarding progress.

    ``profile`` and ``lifestyle`` merge into whatever is already stored, so the
    client can persist one step at a time without resending every answer.
    """

    current_step: str | None = None
    profile: OnboardingProfileIn | None = None
    lifestyle: OnboardingLifestyleIn | None = None
    completed: bool = False

    @field_validator("current_step")
    @classmethod
    def _validate_step(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class OnboardingProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    age_range: str | None = None
    timezone: str | None = None
    preferred_language: str | None = None
    wake_time: str | None = None
    bedtime: str | None = None
    daily_availability: str | None = None


class OnboardingLifestyleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schedule: str | None = None
    study_hours_per_day: str | None = None
    food_budget: str | None = None
    food_preferences: str | None = None
    exercise_experience: str | None = None
    equipment: list[str] | None = None
    existing_routines: str | None = None
    planning_style: str | None = None


class OnboardingOptionsOut(BaseModel):
    """Accepted values for the choice-like onboarding fields."""

    age_range: list[str] = Field(default_factory=list)
    daily_availability: list[str] = Field(default_factory=list)
    schedule: list[str] = Field(default_factory=list)
    study_hours_per_day: list[str] = Field(default_factory=list)
    food_budget: list[str] = Field(default_factory=list)
    exercise_experience: list[str] = Field(default_factory=list)
    equipment: list[str] = Field(default_factory=list)
    planning_style: list[str] = Field(default_factory=list)


def onboarding_options() -> OnboardingOptionsOut:
    return OnboardingOptionsOut(
        age_range=list(AGE_RANGES),
        daily_availability=list(DAILY_AVAILABILITY),
        schedule=list(WORK_STUDY_SCHEDULE),
        study_hours_per_day=list(STUDY_HOURS),
        food_budget=list(FOOD_BUDGET_OPTIONS),
        exercise_experience=list(EXPERIENCE_LEVELS),
        equipment=list(EQUIPMENT_OPTIONS),
        planning_style=list(PLANNING_STYLES),
    )


class OnboardingOut(BaseModel):
    """Current onboarding state for the authenticated user."""

    completed_at: datetime | None = None
    current_step: str | None = None
    profile: OnboardingProfileOut = Field(default_factory=OnboardingProfileOut)
    lifestyle: OnboardingLifestyleOut = Field(default_factory=OnboardingLifestyleOut)
    options: OnboardingOptionsOut = Field(default_factory=OnboardingOptionsOut)
    #: Everything still required before onboarding can be marked complete.
    missing: list[str] = Field(default_factory=list)
