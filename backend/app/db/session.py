"""Engine and session factory for the MAXIMUS database."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def _build_engine():
    settings = get_settings()
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


engine = _build_engine()
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a database session per request."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
