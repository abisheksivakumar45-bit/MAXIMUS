"""Canonical MAXIMUS goal categories and their assessment questions.

This module is the single source of truth for the goal taxonomy. The
``GET /api/goals/categories`` endpoint serialises exactly these definitions and
the onboarding UI renders the assessment form directly from the response, so a
question can never drift between the backend and the frontend.

The taxonomy mirrors ``docs/MASTER_SPEC.md`` §3 (initial user goals) and §4
(screen 5, goal-specific questions). Common attributes shared by every goal
(name, motivation, current situation, desired outcome, priority, target date,
available time, constraints, preferences) live on the goal row itself; only the
category-specific questions are described here.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

AssessmentFieldKind = Literal["text", "textarea", "choice", "multiselect"]

#: Default bounds for free-text assessment answers.
DEFAULT_TEXT_MAX_LENGTH = 200
DEFAULT_TEXTAREA_MAX_LENGTH = 2000


@dataclass(frozen=True)
class AssessmentField:
    """One category-specific onboarding question."""

    key: str
    label: str
    kind: AssessmentFieldKind
    help_text: str = ""
    required: bool = False
    options: tuple[str, ...] = ()
    max_length: int = DEFAULT_TEXT_MAX_LENGTH


@dataclass(frozen=True)
class GoalCategory:
    """A supported goal category and the questions asked for it."""

    slug: str
    label: str
    description: str
    assessment: tuple[AssessmentField, ...] = field(default_factory=tuple)

    @property
    def required_field_keys(self) -> tuple[str, ...]:
        return tuple(f.key for f in self.assessment if f.required)


def _textarea(
    key: str, label: str, *, required: bool = False, help_text: str = ""
) -> AssessmentField:
    return AssessmentField(
        key=key,
        label=label,
        kind="textarea",
        required=required,
        help_text=help_text,
        max_length=DEFAULT_TEXTAREA_MAX_LENGTH,
    )


def _text(key: str, label: str, *, required: bool = False, help_text: str = "") -> AssessmentField:
    return AssessmentField(
        key=key, label=label, kind="text", required=required, help_text=help_text
    )


def _choice(
    key: str, label: str, options: tuple[str, ...], *, required: bool = False, help_text: str = ""
) -> AssessmentField:
    return AssessmentField(
        key=key,
        label=label,
        kind="choice",
        required=required,
        help_text=help_text,
        options=options,
    )


def _multiselect(
    key: str, label: str, options: tuple[str, ...], *, required: bool = False, help_text: str = ""
) -> AssessmentField:
    return AssessmentField(
        key=key,
        label=label,
        kind="multiselect",
        required=required,
        help_text=help_text,
        options=options,
    )


#: Fitness and nutrition questions keep equipment and budget requirements
#: deliberately modest and affordable, per the master specification.
GOAL_CATEGORIES: tuple[GoalCategory, ...] = (
    GoalCategory(
        slug="healthy-weight-nutrition",
        label="Healthy weight and nutrition",
        description="Build affordable, sustainable eating habits that support a healthy weight.",
        assessment=(
            _text("food_preferences", "Foods you enjoy"),
            _text("dietary_restrictions", "Dietary restrictions or allergies"),
            _textarea(
                "affordable_staples",
                "Ingredients that are cheap and available to you",
                help_text="Plain staples keep this affordable — no speciality foods required.",
            ),
            _choice(
                "weekly_budget",
                "Approximate weekly food budget",
                ("Very tight", "Tight", "Moderate", "Flexible"),
            ),
            _choice(
                "cooking_availability",
                "Cooking facilities",
                ("No cooking", "Basic cooking", "Full kitchen"),
            ),
        ),
    ),
    GoalCategory(
        slug="strength-fitness",
        label="Strength and fitness",
        description="Get stronger and fitter with training that fits your equipment and schedule.",
        assessment=(
            _choice(
                "exercise_experience",
                "Training experience",
                ("Never trained", "Beginner", "Intermediate", "Advanced"),
                required=True,
            ),
            _multiselect(
                "equipment",
                "Equipment you can use",
                (
                    "Bodyweight only",
                    "Dumbbells",
                    "Barbells and rack",
                    "Resistance bands",
                    "Kettlebell",
                    "Pull-up bar",
                    "Gym membership",
                ),
                required=True,
                help_text="Pick everything you genuinely have access to.",
            ),
            _choice(
                "time_available",
                "Time available per session",
                ("Under 30 minutes", "30-45 minutes", "45-60 minutes", "60+ minutes"),
                required=True,
            ),
            _textarea(
                "limitations",
                "Injuries, limitations, or anything to work around",
                help_text="Optional. Only share what is relevant to training safely.",
            ),
        ),
    ),
    GoalCategory(
        slug="academics",
        label="Academics",
        description="Improve grades and understanding with a structured study approach.",
        assessment=(
            _text("subjects", "Subjects you are studying"),
            _textarea("upcoming_exams", "Upcoming exams or deadlines"),
            _text("strong_topics", "Topics you are strong in"),
            _text("weak_topics", "Topics you find difficult"),
            _choice(
                "study_time_per_day",
                "Study time available per day",
                ("Under 30 minutes", "30-60 minutes", "1-2 hours", "2-3 hours", "3+ hours"),
            ),
        ),
    ),
    GoalCategory(
        slug="cybersecurity",
        label="Cybersecurity learning",
        description="Learn practical cybersecurity skills with a structured learning path.",
        assessment=(
            _choice(
                "current_skill_level",
                "Current skill level",
                ("Beginner", "Some familiarity", "Intermediate", "Advanced"),
                required=True,
            ),
            _textarea("learned_topics", "Topics you have already learned"),
            _multiselect(
                "career_interests",
                "Career interests",
                (
                    "Penetration testing",
                    "Defensive security / SOC",
                    "Malware analysis",
                    "Cloud security",
                    "Security engineering",
                    "GRC and compliance",
                    "Not sure yet",
                ),
            ),
            _choice(
                "weekly_learning_time",
                "Learning time available per week",
                ("Under 1 hour", "1-3 hours", "3-5 hours", "5-10 hours", "10+ hours"),
                required=True,
            ),
            _textarea("existing_projects", "Existing labs or projects"),
        ),
    ),
    GoalCategory(
        slug="discipline-habits",
        label="Discipline and habits",
        description="Build routines and focus so progress becomes automatic.",
        assessment=(
            _textarea("current_routines", "Your current routines"),
            _text("biggest_obstacle", "The biggest obstacle to consistency"),
            _text("habit_focus", "The habits you most want to build"),
        ),
    ),
    GoalCategory(
        slug="sleep-consistency",
        label="Sleep consistency",
        description="Stabilise your sleep and wake times for better energy and recovery.",
        assessment=(
            _text("current_bedtime", "Your typical bedtime right now"),
            _text("current_wake_time", "Your typical wake time right now"),
            _choice(
                "sleep_quality",
                "How you would rate your sleep",
                ("Poor", "Fair", "Good", "Excellent"),
            ),
            _text("biggest_disruptor", "The thing that most disrupts your sleep"),
        ),
    ),
    GoalCategory(
        slug="personal-development",
        label="Personal development",
        description="Work on confidence, communication, mindset, and life direction.",
        assessment=(
            _text("focus_area", "The area you want to grow in"),
            _textarea("current_challenge", "The challenge you are facing"),
            _textarea("desired_change", "The change you want to see"),
        ),
    ),
    GoalCategory(
        slug="custom",
        label="Custom goal",
        description="Define a goal in your own words.",
        assessment=(
            _textarea("why_it_matters", "Why this goal matters to you", required=True),
            _textarea("success_looks_like", "What success looks like", required=True),
            _text("known_constraints", "Constraints or limitations to plan around"),
        ),
    ),
)

CATEGORIES_BY_SLUG: dict[str, GoalCategory] = {c.slug: c for c in GOAL_CATEGORIES}


def get_category(slug: str) -> GoalCategory | None:
    """Return the category for ``slug``, or None when it is not supported."""
    return CATEGORIES_BY_SLUG.get(slug)


def validate_assessment_answers(slug: str, answers: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and normalise category-specific assessment answers.

    Returns a new dict containing only the category's own fields, trimmed and in
    canonical form. Raises ``ValueError`` with a user-facing message when the
    answers do not satisfy the category's field specification.
    """
    category = get_category(slug)
    if category is None:
        raise ValueError("Unsupported goal category.")

    fields = {spec.key: spec for spec in category.assessment}
    for key in sorted(set(answers) - set(fields)):
        raise ValueError(f"{key!r} is not a question for the {category.label} category.")

    cleaned: dict[str, Any] = {}
    missing: list[str] = []

    for spec in category.assessment:
        raw = answers.get(spec.key)
        value: Any = ""

        if spec.kind == "multiselect":
            if raw is None:
                value = []
            elif not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
                raise ValueError(f"{spec.label} must be a list of choices.")
            else:
                value = [item.strip() for item in raw if item.strip()]
                unsupported = [item for item in value if item not in spec.options]
                if unsupported:
                    raise ValueError(f"{spec.label} contains an unknown choice: {unsupported[0]}.")
        else:
            if raw is None:
                value = ""
            elif not isinstance(raw, str):
                raise ValueError(f"{spec.label} must be text.")
            else:
                value = raw.strip()
                if len(value) > spec.max_length:
                    raise ValueError(f"{spec.label} must be {spec.max_length} characters or fewer.")
                if spec.kind == "choice" and value and value not in spec.options:
                    raise ValueError(f"{spec.label} must be one of the offered choices.")

        if spec.required and not value:
            missing.append(spec.label)
        elif value:
            cleaned[spec.key] = value

    if missing:
        raise ValueError(f"Please answer: {missing[0]}.")

    return cleaned
