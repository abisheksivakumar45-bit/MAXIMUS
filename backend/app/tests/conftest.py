"""Shared pytest fixtures.

Tests run against an in-memory SQLite database so they are fast, isolated,
and require no running PostgreSQL instance. PostgreSQL-specific behaviour
(migrations, types) is verified separately against the real database — see
README.md and docs/IMPLEMENTATION_STATUS.md.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_session
from app.main import create_app


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
    """A session bound to the test database with per-test rollback isolation."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session) -> Iterator[TestClient]:
    """FastAPI test client with the database dependency overridden."""
    application = create_app()

    def _override_get_session() -> Iterator[Session]:
        yield db_session

    application.dependency_overrides[get_session] = _override_get_session
    with TestClient(application) as test_client:
        yield test_client
    application.dependency_overrides.clear()
