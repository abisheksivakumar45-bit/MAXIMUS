"""Shared pytest fixtures.

Tests run against an in-memory SQLite database so they are fast, isolated,
and require no running PostgreSQL instance. PostgreSQL-specific behaviour
(migrations, types) is verified separately against the real database — see
README.md and docs/IMPLEMENTATION_STATUS.md.

``SECRET_KEY`` is mandatory from Phase 2. A deterministic test value is set
below, *before* any application module imports :class:`~app.core.config.Settings`
(which validates it). The application imports therefore carry ``# noqa: E402``.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdef0123456789abcdef")
os.environ.setdefault("APP_ENV", "test")

from app import models  # noqa: E402,F401  (registers all models with Base.metadata)
from app.core.config import Settings, get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_session  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    """In-memory SQLite engine shared across the test session."""
    test_engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(test_engine)
    yield test_engine
    Base.metadata.drop_all(test_engine)
    test_engine.dispose()


@pytest.fixture
def db_session(engine) -> Iterator[Session]:
    """A session bound to the test database with per-test rollback isolation.

    The session joins the connection's outer transaction using SQLAlchemy's
    default nesting behaviour. (An explicit ``join_transaction_mode=
    "create_savepoint"`` was tried first and leaked data across tests on
    SQLite/pysqlite: committed rows survived the outer ``rollback()``.)
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        # A deliberate IntegrityError (see test_models) can leave the outer
        # transaction already deassociated; only roll back it if still active.
        if transaction.is_active:
            transaction.rollback()
        connection.close()


def _override_session(session: Session):
    def _dependency() -> Iterator[Session]:
        yield session

    return _dependency


@pytest.fixture
def app(db_session) -> Iterator:
    """FastAPI app with the database dependency overridden to the test session."""
    application = create_app()
    application.dependency_overrides[get_session] = _override_session(db_session)
    try:
        yield application
    finally:
        application.dependency_overrides.clear()


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    """Test client for the shared test app."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def make_client(db_session):
    """Factory building an app (with custom settings) bound to the test session.

    Used by tests that need different settings — for example a very small
    rate-limit window. Each app gets its own rate limiter, so tests do not
    interfere with one another.
    """
    created: list[TestClient] = []

    def _make(**settings_overrides) -> TestClient:
        settings = Settings(**settings_overrides)
        application = create_app(settings)
        application.dependency_overrides[get_session] = _override_session(db_session)
        test_client = TestClient(application)
        created.append(test_client)
        return test_client

    try:
        yield _make
    finally:
        for test_client in created:
            test_client.close()


@pytest.fixture
def settings() -> Settings:
    """The settings instance used by the default test app."""
    return get_settings()
