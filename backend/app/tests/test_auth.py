"""Authentication endpoint tests.

These exercise the real registration/login/logout/session flow, including the
CSRF handshake, against the app with a SQLite-backed test database.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession
from app.models.user import User
from app.tests.helpers import (
    DEFAULT_PASSWORD,
    SESSION_COOKIE,
    login,
    logout,
    prime_csrf,
    register,
)


def test_register_creates_user_and_starts_session(client: TestClient, db_session: Session) -> None:
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "user@example.com"
    assert body["display_name"] == "Test User"
    assert body["id"]
    assert body["created_at"]

    # A usable session cookie was issued.
    assert client.cookies.get(SESSION_COOKIE)
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "user@example.com"

    # The user is really persisted in the database.
    stored = db_session.query(User).filter_by(email="user@example.com").one()
    assert str(stored.id) == body["id"]


def test_register_normalizes_email_to_lowercase(client: TestClient, db_session: Session) -> None:
    response = register(client, email="MixedCase@Example.COM")

    assert response.status_code == 201
    assert response.json()["email"] == "mixedcase@example.com"
    assert db_session.query(User).filter_by(email="mixedcase@example.com").one()


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    assert register(client).status_code == 201

    duplicate = register(client, email="user@example.com")

    assert duplicate.status_code == 409
    assert "already exists" in duplicate.json()["detail"].lower()


def test_register_rejects_invalid_email(client: TestClient) -> None:
    response = register(client, email="not-an-email")

    assert response.status_code == 422


def test_register_rejects_weak_password(client: TestClient) -> None:
    response = register(client, password="short")

    assert response.status_code == 422


def test_register_rejects_password_without_number(client: TestClient) -> None:
    response = register(client, password="onlylettershere")

    assert response.status_code == 422


def test_password_is_hashed_not_plaintext(client: TestClient, db_session: Session) -> None:
    register(client, password=DEFAULT_PASSWORD)

    stored = db_session.query(User).filter_by(email="user@example.com").one()
    assert stored.password_hash != DEFAULT_PASSWORD
    assert DEFAULT_PASSWORD not in stored.password_hash
    # Argon2id hashes carry the "$argon2id$" identifier.
    assert stored.password_hash.startswith("$argon2")


def test_login_succeeds_after_logout(client: TestClient) -> None:
    register(client)
    logout(client)
    assert client.get("/api/auth/me").status_code == 401

    response = login(client)

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"
    assert client.cookies.get(SESSION_COOKIE)


def test_login_rejects_wrong_password(client: TestClient) -> None:
    register(client)

    response = login(client, password="WrongPassword123")

    assert response.status_code == 401


def test_login_does_not_reveal_whether_email_exists(client: TestClient) -> None:
    register(client, email="known@example.com")

    wrong_password = login(client, email="known@example.com", password="WrongPassword123")
    unknown_email = login(client, email="nobody@example.com", password="WrongPassword123")

    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_me_requires_authentication(client: TestClient) -> None:
    prime_csrf(client)

    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_session_is_restored_for_a_new_client(client: TestClient, app) -> None:
    register(client)
    token = client.cookies.get(SESSION_COOKIE)
    assert token

    # Simulate a fresh browser (e.g. after a page refresh) presenting the same
    # session cookie.
    restored = TestClient(app)
    restored.cookies.set(SESSION_COOKIE, token)
    try:
        response = restored.get("/api/auth/me")
        assert response.status_code == 200
        assert response.json()["email"] == "user@example.com"
    finally:
        restored.close()


def test_logout_revokes_session_for_all_clients(
    client: TestClient, app, db_session: Session
) -> None:
    register(client)
    token = client.cookies.get(SESSION_COOKIE)
    assert token

    other = TestClient(app)
    other.cookies.set(SESSION_COOKIE, token)
    try:
        assert other.get("/api/auth/me").status_code == 200

        assert logout(client).status_code == 200

        # The session is invalidated server-side, not just in the browser.
        assert other.get("/api/auth/me").status_code == 401
    finally:
        other.close()

    stored = db_session.query(AuthSession).one()
    assert stored.revoked_at is not None


def test_forged_session_token_is_rejected(client: TestClient) -> None:
    prime_csrf(client)
    client.cookies.set(SESSION_COOKIE, "definitely-not-a-real-token")

    assert client.get("/api/auth/me").status_code == 401
