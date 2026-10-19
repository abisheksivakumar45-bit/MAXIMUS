"""Helpers for exercising the real authentication/CSRF flow in tests.

These perform actual HTTP calls (including the CSRF handshake) against the
app under test — nothing is bypassed or mocked.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from httpx import Response

CSRF_COOKIE = "maximus_csrf"
CSRF_HEADER = "X-CSRF-Token"
SESSION_COOKIE = "maximus_session"

DEFAULT_PASSWORD = "TestPassword123"
DEFAULT_EMAIL = "user@example.com"
DEFAULT_DISPLAY_NAME = "Test User"


def prime_csrf(client: TestClient) -> str:
    """Trigger issuance of the CSRF cookie via a safe request and return it."""
    client.get("/api/auth/me")
    token = client.cookies.get(CSRF_COOKIE)
    assert token, "CSRF cookie was not issued by the safe request"
    return token


def csrf_headers(client: TestClient) -> dict[str, str]:
    """Return the CSRF header for the current client cookie jar."""
    token = client.cookies.get(CSRF_COOKIE)
    return {CSRF_HEADER: token} if token else {}


def register(
    client: TestClient,
    *,
    email: str = DEFAULT_EMAIL,
    password: str = DEFAULT_PASSWORD,
    display_name: str = DEFAULT_DISPLAY_NAME,
) -> Response:
    """Register an account (performing the CSRF handshake first)."""
    prime_csrf(client)
    return client.post(
        "/api/auth/register",
        json={"display_name": display_name, "email": email, "password": password},
        headers=csrf_headers(client),
    )


def login(
    client: TestClient,
    *,
    email: str = DEFAULT_EMAIL,
    password: str = DEFAULT_PASSWORD,
) -> Response:
    """Log in (performing the CSRF handshake first)."""
    prime_csrf(client)
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers=csrf_headers(client),
    )


def logout(client: TestClient) -> Response:
    """Log out the current session."""
    return client.post("/api/auth/logout", headers=csrf_headers(client))


def update_profile(client: TestClient, *, display_name: str) -> Response:
    """Patch the current user's display name."""
    return client.patch(
        "/api/profile",
        json={"display_name": display_name},
        headers=csrf_headers(client),
    )


# -- goals -------------------------------------------------------------------
def create_goal(client: TestClient, **fields) -> Response:
    """Create a goal for the current user (CSRF handshake assumed done)."""
    payload = {"name": "My goal", "category": "custom", **fields}
    return client.post("/api/goals", json=payload, headers=csrf_headers(client))


def create_second_client(db_session, **settings_overrides) -> TestClient:
    """Build a second independent client sharing the same test database."""
    from app.core.config import Settings
    from app.db.session import get_session
    from app.main import create_app

    settings = Settings(**settings_overrides)
    application = create_app(settings)

    def _dependency():
        yield db_session

    application.dependency_overrides[get_session] = _dependency
    return TestClient(application)


def save_onboarding(client: TestClient, **fields) -> Response:
    """PUT onboarding progress for the current user."""
    return client.put(
        "/api/onboarding",
        json=fields,
        headers=csrf_headers(client),
    )
