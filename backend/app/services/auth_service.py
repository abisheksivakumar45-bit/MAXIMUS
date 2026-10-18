"""Authentication and profile business logic.

The service owns password verification, session issuance/revocation, and
profile updates. Routes stay thin: they translate service outcomes into HTTP
responses. Nothing here trusts a client-supplied user id — identity always
comes from a validated session token.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    password_needs_rehash,
    verify_password,
    verify_password_against_dummy,
)
from app.models.user import User
from app.repositories.session_repository import SessionRepository, as_utc
from app.repositories.user_repository import UserRepository

#: A session's ``last_used_at`` is refreshed at most this often to avoid a
#: write on every authenticated request.
_LAST_USED_REFRESH = timedelta(minutes=5)


class AuthError(Exception):
    """Base class for authentication failures."""


class EmailAlreadyRegisteredError(AuthError):
    """Raised when registering an email that already has an account."""


class InvalidCredentialsError(AuthError):
    """Raised when login credentials do not match an active account."""


class AuthService:
    """Coordinates user, password, and session operations."""

    def __init__(self, session: Session, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._users = UserRepository(session)
        self._sessions = SessionRepository(session)

    # -- registration and login ---------------------------------------------
    def register(self, *, display_name: str, email: str, password: str) -> tuple[User, str]:
        """Create an account and log it in, returning ``(user, session_token)``."""
        if self._users.get_by_email(email) is not None:
            raise EmailAlreadyRegisteredError

        user = self._users.create(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
        )
        token = self._issue_session(user)
        self._session.commit()
        return user, token

    def login(self, *, email: str, password: str) -> tuple[User, str]:
        """Verify credentials and start a session, returning ``(user, token)``."""
        user = self._users.get_by_email(email)
        if user is None:
            # Equalise timing so the response does not reveal whether the
            # email exists.
            verify_password_against_dummy(password)
            raise InvalidCredentialsError

        if not verify_password(password, user.password_hash) or not user.is_active:
            raise InvalidCredentialsError

        if password_needs_rehash(user.password_hash):
            # Transparently upgrade the stored hash on successful login.
            user.password_hash = hash_password(password)

        token = self._issue_session(user)
        self._session.commit()
        return user, token

    def logout(self, token: str) -> None:
        """Revoke the session identified by ``token`` (idempotent)."""
        token_hash = hash_session_token(token, self._settings.secret_key)
        auth_session = self._sessions.get_by_token_hash(token_hash)
        if auth_session is not None and auth_session.revoked_at is None:
            auth_session.revoked_at = datetime.now(UTC)
            self._session.commit()

    # -- session resolution --------------------------------------------------
    def resolve_session(self, token: str) -> User | None:
        """Return the active user for ``token``, or None if it is not valid."""
        token_hash = hash_session_token(token, self._settings.secret_key)
        auth_session = self._sessions.get_by_token_hash(token_hash)
        if auth_session is None or auth_session.revoked_at is not None:
            return None

        now = datetime.now(UTC)
        if as_utc(auth_session.expires_at) <= now:
            return None

        user = self._users.get_by_id(auth_session.user_id)
        if user is None or not user.is_active:
            return None

        if (now - as_utc(auth_session.last_used_at)) > _LAST_USED_REFRESH:
            auth_session.last_used_at = now
            self._session.commit()

        return user

    # -- profile -------------------------------------------------------------
    def update_profile(self, user: User, *, display_name: str | None) -> User:
        """Update the caller's own profile and return the refreshed user."""
        if display_name is not None:
            user.display_name = display_name
            self._session.commit()
        return user

    # -- internals -----------------------------------------------------------
    def _issue_session(self, user: User) -> str:
        self._sessions.purge_expired_for_user(user.id)
        token = generate_session_token()
        expires_at = datetime.now(UTC) + timedelta(days=self._settings.session_lifetime_days)
        self._sessions.create(
            user_id=user.id,
            token_hash=hash_session_token(token, self._settings.secret_key),
            expires_at=expires_at,
        )
        return token
