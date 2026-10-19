"""Database access for onboarding progress."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user_onboarding import UserOnboarding


class OnboardingRepository:
    """Persistence operations for :class:`~app.models.user_onboarding.UserOnboarding`."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_for_user(self, user_id: uuid.UUID) -> UserOnboarding | None:
        statement = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
        return self._session.execute(statement).scalar_one_or_none()

    def get_or_create(self, user_id: uuid.UUID) -> UserOnboarding:
        """Return the user's onboarding row, creating it on first use."""
        onboarding = self.get_for_user(user_id)
        if onboarding is None:
            onboarding = UserOnboarding(user_id=user_id)
            self._session.add(onboarding)
            self._session.flush()
        return onboarding
