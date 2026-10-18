"""Migration tests.

These run the real Alembic migrations end-to-end against a temporary SQLite
database. They catch syntax errors, broken revision chains, and upgrade/
downgrade regressions that a model-only test (Base.metadata.create_all) would
miss. PostgreSQL-specific behaviour is still verified against the running
container as part of phase verification.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command
from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture
def alembic_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Config, str]:
    db_path = tmp_path / "migration_test.db"
    database_url = f"sqlite+pysqlite:///{db_path}"

    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))

    try:
        yield config, database_url
    finally:
        get_settings.cache_clear()


def test_upgrade_creates_users_table(alembic_config) -> None:
    config, database_url = alembic_config

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert "users" in inspector.get_table_names()

        columns = {column["name"] for column in inspector.get_columns("users")}
        assert columns == {
            "id",
            "email",
            "password_hash",
            "display_name",
            "is_active",
            "created_at",
            "updated_at",
        }

        indexes = {index["name"] for index in inspector.get_indexes("users")}
        assert any("email" in name for name in indexes)
    finally:
        engine.dispose()


def test_downgrade_removes_users_table(alembic_config) -> None:
    config, database_url = alembic_config

    command.upgrade(config, "head")
    command.downgrade(config, "base")

    engine = create_engine(database_url)
    try:
        assert "users" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()
