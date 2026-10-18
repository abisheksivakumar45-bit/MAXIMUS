"""Security-focused tests: CSRF, rate limiting, cookie flags, CORS, no leaks."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.tests.helpers import (
    CSRF_COOKIE,
    CSRF_HEADER,
    DEFAULT_PASSWORD,
    SESSION_COOKIE,
    csrf_headers,
    prime_csrf,
    register,
)

REGISTER_PAYLOAD = {
    "display_name": "Attacker",
    "email": "attacker@example.com",
    "password": DEFAULT_PASSWORD,
}


def test_state_changing_request_without_csrf_is_rejected(client: TestClient) -> None:
    response = client.post("/api/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF validation failed"


def test_state_changing_request_with_mismatched_csrf_is_rejected(client: TestClient) -> None:
    prime_csrf(client)

    response = client.post(
        "/api/auth/register",
        json=REGISTER_PAYLOAD,
        headers={CSRF_HEADER: "a-different-token"},
    )

    assert response.status_code == 403


def test_state_changing_request_with_csrf_succeeds(client: TestClient) -> None:
    prime_csrf(client)

    response = client.post(
        "/api/auth/register", json=REGISTER_PAYLOAD, headers=csrf_headers(client)
    )

    assert response.status_code == 201


def test_safe_request_issues_csrf_cookie(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert client.cookies.get(CSRF_COOKIE)


def test_login_is_rate_limited(make_client) -> None:
    client = make_client(auth_rate_limit_attempts=3, auth_rate_limit_window_seconds=60)
    prime_csrf(client)
    payload = {"email": "nobody@example.com", "password": "WrongPassword123"}

    statuses = [
        client.post("/api/auth/login", json=payload, headers=csrf_headers(client)).status_code
        for _ in range(5)
    ]

    assert statuses[:3] == [401, 401, 401]
    assert statuses[3] == 429
    assert statuses[4] == 429


def test_rate_limited_response_advertises_retry_after(make_client) -> None:
    client = make_client(auth_rate_limit_attempts=1, auth_rate_limit_window_seconds=60)
    prime_csrf(client)
    payload = {"email": "nobody@example.com", "password": "WrongPassword123"}

    client.post("/api/auth/login", json=payload, headers=csrf_headers(client))
    limited = client.post("/api/auth/login", json=payload, headers=csrf_headers(client))

    assert limited.status_code == 429
    assert "Retry-After" in limited.headers


def test_session_cookie_is_httponly_and_samesite(client: TestClient) -> None:
    response = register(client)
    set_cookie = "\n".join(response.headers.get_list("set-cookie"))

    assert f"{SESSION_COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "samesite=lax" in set_cookie.lower()


def test_responses_never_expose_password_material(client: TestClient) -> None:
    register(client, password=DEFAULT_PASSWORD)

    for path in ("/api/auth/me", "/api/profile"):
        text = client.get(path).text.lower()
        assert "password" not in text
        assert "$argon2" not in text
        assert DEFAULT_PASSWORD.lower() not in text


def test_cors_allows_configured_origin_with_credentials(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})

    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_does_not_allow_unknown_origin(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "http://evil.example.com"})

    assert "access-control-allow-origin" not in response.headers
