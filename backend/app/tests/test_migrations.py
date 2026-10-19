"""Migration tests.

These run the real Alembic migrations end-to-end against a temporary SQLite
database. They catch syntax errors, broken revision chains, and upgrade/
downgrade regressions that a model-only test (Base.metadata.create_all) would
miss. PostgreSQL-specific behaviour is still verified against the running
container as part of phase verification.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect

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


def test_upgrade_creates_auth_sessions_table(alembic_config) -> None:
    config, database_url = alembic_config

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert "auth_sessions" in inspector.get_table_names()

        columns = {column["name"] for column in inspector.get_columns("auth_sessions")}
        assert columns == {
            "id",
            "user_id",
            "token_hash",
            "created_at",
            "expires_at",
            "last_used_at",
            "revoked_at",
        }

        token_indexes = [
            index
            for index in inspector.get_indexes("auth_sessions")
            if index["column_names"] == ["token_hash"]
        ]
        assert token_indexes and token_indexes[0]["unique"]

        foreign_keys = inspector.get_foreign_keys("auth_sessions")
        assert any(fk["referred_table"] == "users" for fk in foreign_keys)
    finally:
        engine.dispose()


def test_downgrade_removes_auth_sessions_table(alembic_config) -> None:
    config, database_url = alembic_config

    command.upgrade(config, "head")
    command.downgrade(config, "0001")

    engine = create_engine(database_url)
    try:
        tables = inspect(engine).get_table_names()
        assert "auth_sessions" not in tables
        # Downgrading one revision keeps the earlier schema intact.
        assert "users" in tables
    finally:
        engine.dispose()


def test_upgrade_creates_goals_and_onboarding_tables(alembic_config) -> None:
    config, database_url = alembic_config

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert {"goals", "goal_assessments", "user_onboarding"} <= tables

        # --- goals --------------------------------------------------------
        goal_columns = {c["name"] for c in inspector.get_columns("goals")}
        assert goal_columns == {
            "id",
            "user_id",
            "name",
            "description",
            "category",
            "motivation",
            "current_situation",
            "desired_outcome",
            "priority",
            "target_date",
            "available_time",
            "constraints",
            "preferences",
            "status",
            "created_at",
            "updated_at",
        }

        goal_unique = inspector.get_unique_constraints("goals")
        assert any(
            set(constraint["column_names"]) == {"user_id", "category", "name"}
            for constraint in goal_unique
        )

        goal_fks = inspector.get_foreign_keys("goals")
        assert any(fk["referred_table"] == "users" for fk in goal_fks)

        # --- goal_assessments ---------------------------------------------
        assessment_columns = {c["name"] for c in inspector.get_columns("goal_assessments")}
        assert assessment_columns == {
            "id",
            "goal_id",
            "user_id",
            "answers",
            "created_at",
            "updated_at",
        }

        assessment_unique = inspector.get_unique_constraints("goal_assessments")
        assert any(constraint["column_names"] == ["goal_id"] for constraint in assessment_unique)

        assessment_fks = inspector.get_foreign_keys("goal_assessments")
        assert any(fk["referred_table"] == "goals" for fk in assessment_fks)
        assert any(fk["referred_table"] == "users" for fk in assessment_fks)

        # --- user_onboarding ----------------------------------------------
        onboarding_columns = {c["name"] for c in inspector.get_columns("user_onboarding")}
        assert "completed_at" in onboarding_columns
        assert "current_step" in onboarding_columns

        onboarding_unique = inspector.get_unique_constraints("user_onboarding")
        assert any(constraint["column_names"] == ["user_id"] for constraint in onboarding_unique)

        onboarding_fks = inspector.get_foreign_keys("user_onboarding")
        assert any(fk["referred_table"] == "users" for fk in onboarding_fks)
    finally:
        engine.dispose()


def test_downgrade_removes_phase3_tables_and_keeps_users(alembic_config) -> None:
    config, database_url = alembic_config

    command.upgrade(config, "head")
    command.downgrade(config, "0002")

    engine = create_engine(database_url)
    try:
        tables = set(inspect(engine).get_table_names())
        assert "goals" not in tables
        assert "goal_assessments" not in tables
        assert "user_onboarding" not in tables
        # Phase 1 and Phase 2 tables survive the downgrade.
        assert {"users", "auth_sessions"} <= tables
    finally:
        engine.dispose()


def test_goals_uniqueness_constraint_is_enforced(alembic_config) -> None:
    """The (user_id, category, name) uniqueness rule is a real DB constraint."""
    from sqlalchemy import insert

    from app import models  # noqa: F401  (registers all models with Base.metadata)
    from app.db.base import Base

    config, database_url = alembic_config

    command.upgrade(config, "head")

    owner_id = uuid.UUID("11111111-1111-1111-1111-111111111111")

    engine = create_engine(database_url)
    try:
        Base.metadata.create_all(engine)  # no-op for existing tables
        with engine.begin() as conn:
            conn.execute(
                insert(models.User).values(
                    id=owner_id,
                    email="migration@example.com",
                    password_hash="x",
                    display_name="Migration User",
                )
            )
            conn.execute(
                insert(models.Goal).values(
                    id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
                    user_id=owner_id,
                    name="Same name",
                    category="custom",
                )
            )
            with pytest.raises(Exception) as excinfo:
                conn.execute(
                    insert(models.Goal).values(
                        id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
                        user_id=owner_id,
                        name="Same name",
                        category="custom",
                    )
                )
            assert "UNIQUE" in str(excinfo.value).upper()
    finally:
        engine.dispose()


def test_phase3_foreign_keys_cascade_on_user_delete(alembic_config) -> None:
    """Deleting a user removes their goals and assessments (ON DELETE CASCADE)."""
    from sqlalchemy import insert, text

    from app import models  # noqa: F401

    config, database_url = alembic_config

    command.upgrade(config, "head")

    owner_id = uuid.UUID("44444444-4444-4444-4444-444444444444")
    goal_id = uuid.UUID("55555555-5555-5555-5555-555555555555")

    engine = create_engine(database_url)

    # SQLite does not enforce foreign keys unless the pragma is set per
    # connection (PostgreSQL always enforces them). Enable it so this test
    # genuinely exercises the ON DELETE CASCADE clauses the migration created.
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    try:
        with engine.begin() as conn:
            conn.execute(
                insert(models.User).values(
                    id=owner_id,
                    email="cascade@example.com",
                    password_hash="x",
                    display_name="Cascade User",
                )
            )
            conn.execute(
                insert(models.Goal).values(
                    id=goal_id,
                    user_id=owner_id,
                    name="Cascade goal",
                    category="custom",
                )
            )
            conn.execute(
                insert(models.GoalAssessment).values(
                    id=uuid.UUID("66666666-6666-6666-6666-666666666666"),
                    goal_id=goal_id,
                    user_id=owner_id,
                    answers={"why_it_matters": "Test"},
                )
            )
            conn.execute(
                insert(models.UserOnboarding).values(
                    id=uuid.UUID("77777777-7777-7777-7777-777777777777"),
                    user_id=owner_id,
                )
            )

        with engine.begin() as conn:
            # SQLAlchemy's Uuid type persists values as 32-char hex on SQLite,
            # so a raw text() predicate must use the same (undashed) form.
            conn.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": owner_id.hex})
            goals = conn.execute(text("SELECT COUNT(*) FROM goals")).scalar()
            assessments = conn.execute(text("SELECT COUNT(*) FROM goal_assessments")).scalar()
            onboarding = conn.execute(text("SELECT COUNT(*) FROM user_onboarding")).scalar()
            assert goals == 0
            assert assessments == 0
            assert onboarding == 0
    finally:
        engine.dispose()
