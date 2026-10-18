"""Tests for the health and readiness endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import create_app


def test_root_returns_service_info(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "MAXIMUS"
    assert body["health"] == "/api/health"


def test_health_returns_service_metadata(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "MAXIMUS"
    assert body["status"] == "ok"
    assert body["environment"]
    assert body["version"]
    assert "timestamp" in body


def test_liveness_does_not_require_database(engine) -> None:
    # Build an app without overriding the database dependency: liveness must
    # still succeed because it never touches the database.
    application = create_app()
    with TestClient(application) as client:
        response = client.get("/api/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_readiness_reports_database_connected(client: TestClient) -> None:
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["database"]["connected"] is True


def test_readiness_returns_503_when_database_unreachable() -> None:
    application = create_app()

    class BrokenSession:
        def execute(self, *_args, **_kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    from app.db.session import get_session

    def _broken_session():
        yield BrokenSession()

    application.dependency_overrides[get_session] = _broken_session
    with TestClient(application) as client:
        response = client.get("/api/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == "Database is unreachable"
