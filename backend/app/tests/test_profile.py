"""Profile endpoint tests, including per-user isolation."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.tests.helpers import prime_csrf, register, update_profile

EXPECTED_FIELDS = {"id", "email", "display_name", "created_at"}


def test_get_profile_returns_own_record(client: TestClient) -> None:
    register(client, email="alice@example.com", display_name="Alice")

    response = client.get("/api/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["display_name"] == "Alice"
    assert set(body) == EXPECTED_FIELDS


def test_get_profile_requires_authentication(client: TestClient) -> None:
    prime_csrf(client)

    assert client.get("/api/profile").status_code == 401


def test_patch_profile_updates_display_name(client: TestClient, db_session: Session) -> None:
    register(client)

    response = update_profile(client, display_name="New Name")

    assert response.status_code == 200
    assert response.json()["display_name"] == "New Name"

    stored = db_session.query(User).filter_by(email="user@example.com").one()
    assert stored.display_name == "New Name"


def test_patch_profile_trims_whitespace(client: TestClient) -> None:
    register(client)

    response = update_profile(client, display_name="  Padded Name  ")

    assert response.status_code == 200
    assert response.json()["display_name"] == "Padded Name"


def test_patch_profile_rejects_blank_display_name(client: TestClient) -> None:
    register(client)

    response = update_profile(client, display_name="   ")

    assert response.status_code == 422


def test_patch_profile_requires_authentication(client: TestClient) -> None:
    prime_csrf(client)

    response = update_profile(client, display_name="Nope")

    assert response.status_code == 401


def test_profile_updates_are_isolated_between_users(app) -> None:
    alice = TestClient(app)
    bob = TestClient(app)
    try:
        register(alice, email="alice@example.com", display_name="Alice")
        register(bob, email="bob@example.com", display_name="Bob")

        assert update_profile(alice, display_name="Alice Updated").status_code == 200

        # Bob's profile is untouched, and each client only ever sees its own.
        assert bob.get("/api/profile").json()["display_name"] == "Bob"
        assert bob.get("/api/profile").json()["email"] == "bob@example.com"
        assert alice.get("/api/profile").json()["display_name"] == "Alice Updated"
        assert alice.get("/api/profile").json()["email"] == "alice@example.com"
    finally:
        alice.close()
        bob.close()
