"""Onboarding business logic.

Onboarding is deliberately resumable: each save is a partial merge into the
stored row, so an interrupted run can continue exactly where it stopped. The
row is only marked complete once every requirement below is satisfied — the
server is the authority on that, never the client.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_onboarding import UserOnboarding
from app.repositories.goal_repository import GoalRepository
from app.repositories.onboarding_repository import OnboardingRepository
from app.schemas.onboarding import OnboardingSave


class OnboardingIncompleteError(Exception):
    """Raised when completion is requested but required answers are missing."""

    def __init__(self, missing: list[str]) -> None:
        super().__init__("Onboarding is not complete yet.")
        self.missing = missing


class OnboardingService:
    """Coordinates onboarding progress for one user."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._onboarding = OnboardingRepository(session)
        self._goals = GoalRepository(session)

    # -- reads ---------------------------------------------------------------
    def get_status(self, user: User) -> tuple[UserOnboarding | None, list[str]]:
        """Return the stored onboarding row (or None) and any missing answers."""
        row = self._onboarding.get_for_user(user.id)
        return row, self.missing_requirements(user, row)

    def missing_requirements(self, user: User, row: UserOnboarding | None = None) -> list[str]:
        """Human-readable list of everything still needed to finish onboarding."""
        if row is None:
            row = self._onboarding.get_for_user(user.id)
        missing: list[str] = []

        if not (user.display_name and user.display_name.strip()):
            missing.append("a display name")
        if row is None or not row.timezone:
            missing.append("your time zone")
        if row is None or not row.daily_availability:
            missing.append("your daily availability")
        if self._goals.count_for_user(user.id) == 0:
            missing.append("at least one goal")

        return missing

    # -- writes --------------------------------------------------------------
    def save(self, user: User, payload: OnboardingSave) -> tuple[UserOnboarding, list[str]]:
        """Merge the partial save into the stored row and return the missing list."""
        row = self._onboarding.get_or_create(user.id)

        if payload.current_step is not None:
            row.current_step = payload.current_step

        if payload.profile is not None:
            self._merge(row, payload.profile.model_dump(exclude_unset=True))

        if payload.lifestyle is not None:
            self._merge(row, payload.lifestyle.model_dump(exclude_unset=True))

        missing = self.missing_requirements(user, row)
        if payload.completed:
            if missing:
                raise OnboardingIncompleteError(missing)
            row.completed_at = datetime.now(UTC)
            # The review step is the approval point: goals drafted during
            # onboarding become active in the same transaction that records
            # completion, so the dashboard never shows a half-finished state.
            self._goals.activate_drafts(user.id)

        self._session.commit()
        return row, missing

    # -- internals -----------------------------------------------------------
    @staticmethod
    def _merge(row: UserOnboarding, changes: dict[str, object]) -> None:
        for field_name, value in changes.items():
            setattr(row, field_name, value)


def describe_missing(missing: list[str]) -> str:
    """Build a client-facing message from a missing-requirements list."""
    if not missing:
        return "Onboarding is complete."
    if len(missing) == 1:
        return f"Onboarding still needs {missing[0]}."
    joined = ", ".join(missing[:-1]) + f" and {missing[-1]}"
    return f"Onboarding still needs {joined}."
