"""Database access for authentication sessions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession


def as_utc(value: datetime) -> datetime:
    """Return ``value`` as a timezone-aware UTC datetime.

    PostgreSQL returns timezone-aware values; SQLite (used in the fast test
    suite) stores naive ones. Both are UTC, so naive values are labelled UTC.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class SessionRepository:
    """Persistence operations for :class:`~app.models.auth_session.AuthSession`."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
        self,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
    ) -> AuthSession:
        now = datetime.now(UTC)
        auth_session = AuthSession(
            user_id=user_id,
            token_hash=token_hash,
            created_at=now,
            expires_at=expires_at,
            last_used_at=now,
        )
        self._session.add(auth_session)
        self._session.flush()
        return auth_session

    def get_by_token_hash(self, token_hash: str) -> AuthSession | None:
        statement = select(AuthSession).where(AuthSession.token_hash == token_hash)
        return self._session.execute(statement).scalar_one_or_none()

    def purge_expired_for_user(self, user_id: uuid.UUID) -> None:
        """Delete expired sessions for a user (called when issuing a new one).

        Expiry is evaluated in Python so the behaviour is identical on
        PostgreSQL and SQLite.
        """
        now = datetime.now(UTC)
        statement = select(AuthSession).where(AuthSession.user_id == user_id)
        sessions = self._session.execute(statement).scalars().all()
        for auth_session in sessions:
            if as_utc(auth_session.expires_at) <= now:
                self._session.delete(auth_session)
