"""Database access for user accounts."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def normalize_email(email: str) -> str:
    """Canonical form used for storage and lookup (trimmed, lower-cased)."""
    return email.strip().lower()


class UserRepository:
    """Persistence operations for :class:`~app.models.user.User`."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == normalize_email(email))
        return self._session.execute(statement).scalar_one_or_none()

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self._session.get(User, user_id)

    def create(self, *, email: str, password_hash: str, display_name: str) -> User:
        user = User(
            email=normalize_email(email),
            password_hash=password_hash,
            display_name=display_name,
        )
        self._session.add(user)
        self._session.flush()
        return user
