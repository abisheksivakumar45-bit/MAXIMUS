"""Password hashing, session-token generation, and token digesting.

Security choices
----------------
* Passwords are hashed with **Argon2id** using ``argon2-cffi`` defaults
  (64 MiB memory, 3 iterations, 4 lanes) — a modern, memory-hard KDF.
* Session tokens are 256-bit random values (``secrets.token_urlsafe``).
* Only an **HMAC-SHA256 digest keyed with ``SECRET_KEY``** is persisted, so a
  database dump alone cannot be used to forge a valid session.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

#: Argon2id hasher with library defaults (secure by default).
_hasher = PasswordHasher()

#: Entropy of a session token: 32 random bytes -> 256 bits.
_SESSION_TOKEN_BYTES = 32


def hash_password(password: str) -> str:
    """Return an Argon2id hash (includes salt and parameters)."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return True when ``password`` matches ``password_hash``."""
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError, VerificationError, InvalidHashError:
        return False


def password_needs_rehash(password_hash: str) -> bool:
    """Return True when a stored hash uses outdated parameters."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    """A real Argon2 hash used only to equalise login timing."""
    return _hasher.hash(secrets.token_urlsafe(16))


def verify_password_against_dummy(password: str) -> None:
    """Perform a real verification against a throwaway hash.

    Called when an email is unknown so that the login response time does not
    reveal whether an account exists (mitigates user enumeration by timing).
    """
    verify_password(password, _dummy_password_hash())


def generate_session_token() -> str:
    """Return a new opaque, high-entropy session token."""
    return secrets.token_urlsafe(_SESSION_TOKEN_BYTES)


def hash_session_token(token: str, secret_key: str) -> str:
    """Return the keyed digest persisted for a session token."""
    return hmac.new(
        secret_key.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def generate_csrf_token() -> str:
    """Return a new random CSRF token."""
    return secrets.token_urlsafe(32)


def constant_time_compare(left: str, right: str) -> bool:
    """Compare two strings without leaking timing information."""
    return hmac.compare_digest(left, right)
