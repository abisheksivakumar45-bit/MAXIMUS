"""Tests for the foundational ORM models."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.health import HealthResponse


def test_user_roundtrip_persists_fields(db_session: Session) -> None:
    user = User(
        email="foundation@example.com",
        password_hash="not-a-real-hash",
        display_name="Foundation User",
    )
    db_session.add(user)
    db_session.commit()

    stored = db_session.get(User, user.id)
    assert stored is not None
    assert isinstance(stored.id, uuid.UUID)
    assert stored.email == "foundation@example.com"
    assert stored.display_name == "Foundation User"
    assert stored.is_active is True
    assert stored.created_at is not None
    assert stored.updated_at is not None


def test_user_email_must_be_unique(db_session: Session) -> None:
    db_session.add(User(email="duplicate@example.com", password_hash="h1"))
    db_session.commit()

    db_session.add(User(email="duplicate@example.com", password_hash="h2"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_health_schema_rejects_missing_fields() -> None:
    with pytest.raises(ValueError):
        HealthResponse(  # type: ignore[call-arg]
            service="MAXIMUS",
            version="0.1.0",
            environment="test",
            status="ok",
        )
