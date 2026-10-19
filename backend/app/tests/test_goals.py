"""Goal and onboarding tests.

Covers the full lifecycle: goal categories, CRUD, per-user isolation, input
validation, assessment validation, onboarding progress/resume/completion, and
regression of the Phase 2 auth/profile behaviour.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_session
from app.main import create_app
from app.models.goal import Goal
from app.models.goal_assessment import GoalAssessment
from app.models.user_onboarding import UserOnboarding
from app.tests.helpers import (
    create_goal,
    csrf_headers,
    prime_csrf,
    register,
    save_onboarding,
)

# --- goal categories ---------------------------------------------------------


def test_list_categories_returns_canonical_set(client: TestClient) -> None:
    register(client)
    response = client.get("/api/goals/categories")
    assert response.status_code == 200
    slugs = [c["slug"] for c in response.json()]
    assert slugs == [
        "healthy-weight-nutrition",
        "strength-fitness",
        "academics",
        "cybersecurity",
        "discipline-habits",
        "sleep-consistency",
        "personal-development",
        "custom",
    ]


def test_list_categories_is_public(client: TestClient) -> None:
    prime_csrf(client)
    response = client.get("/api/goals/categories")
    assert response.status_code == 200


def test_category_assessment_fields_include_required_flags(client: TestClient) -> None:
    register(client)
    body = client.get("/api/goals/categories").json()
    fitness = next(c for c in body if c["slug"] == "strength-fitness")
    required = {f["key"] for f in fitness["assessment"] if f["required"]}
    assert required == {"exercise_experience", "equipment", "time_available"}
    choice_fields = [f for f in fitness["assessment"] if f["kind"] in {"choice", "multiselect"}]
    assert all(f["options"] for f in choice_fields)
    # Text limits are exposed so the client mirrors the server's validation.
    limitations = next(f for f in fitness["assessment"] if f["key"] == "limitations")
    assert limitations["max_length"] == 2000


# --- goal CRUD ---------------------------------------------------------------


def test_create_goal_without_assessment(client: TestClient, db_session: Session) -> None:
    register(client)
    response = create_goal(client, name="Learn pentesting", category="cybersecurity")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Learn pentesting"
    assert body["category"] == "cybersecurity"
    assert body["category_label"] == "Cybersecurity learning"
    assert body["status"] == "draft"
    assert body["priority"] == "medium"
    assert body["assessment"] is None

    stored = db_session.query(Goal).filter_by(name="Learn pentesting").one()
    assert stored.category == "cybersecurity"


def test_create_goal_with_assessment(client: TestClient, db_session: Session) -> None:
    register(client)
    response = create_goal(
        client,
        name="Bulk up",
        category="strength-fitness",
        assessment={
            "exercise_experience": "Beginner",
            "equipment": ["Bodyweight only", "Dumbbells"],
            "time_available": "30-45 minutes",
            "limitations": "Bad left knee",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["assessment"]["answers"]["exercise_experience"] == "Beginner"
    assert body["assessment"]["answers"]["equipment"] == ["Bodyweight only", "Dumbbells"]

    stored = db_session.query(GoalAssessment).filter_by(user_id=stored_user_id(db_session)).one()
    assert stored.answers["exercise_experience"] == "Beginner"


def stored_user_id(db_session: Session):
    from app.models.user import User

    return db_session.query(User).one().id


def test_list_goals_returns_only_own(client: TestClient, app) -> None:
    alice = TestClient(app)
    bob = TestClient(app)
    try:
        register(alice, email="alice@example.com", display_name="Alice")
        register(bob, email="bob@example.com", display_name="Bob")

        create_goal(alice, name="Alice goal", category="custom")
        create_goal(bob, name="Bob goal", category="custom")

        alice_goals = alice.get("/api/goals").json()
        bob_goals = bob.get("/api/goals").json()
        assert [g["name"] for g in alice_goals] == ["Alice goal"]
        assert [g["name"] for g in bob_goals] == ["Bob goal"]
    finally:
        alice.close()
        bob.close()


def test_get_goal_by_id(client: TestClient) -> None:
    register(client)
    created = create_goal(client, name="Sleep better", category="sleep-consistency").json()
    response = client.get(f"/api/goals/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_update_goal_fields(client: TestClient, db_session: Session) -> None:
    register(client)
    created = create_goal(client, name="Draft goal", category="academics").json()

    response = client.patch(
        f"/api/goals/{created['id']}",
        json={"name": "Renamed goal", "priority": "high", "status": "active"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed goal"
    assert body["priority"] == "high"
    assert body["status"] == "active"

    stored = db_session.query(Goal).filter_by(id=uuid.UUID(created["id"])).one()
    assert stored.name == "Renamed goal"
    assert stored.priority == "high"


def test_update_goal_assessment_merges_answers(client: TestClient) -> None:
    register(client)
    created = create_goal(
        client,
        name="Fitness",
        category="strength-fitness",
        assessment={
            "exercise_experience": "Beginner",
            "equipment": ["Bodyweight only"],
            "time_available": "30-45 minutes",
        },
    ).json()

    response = client.patch(
        f"/api/goals/{created['id']}",
        json={"assessment": {"equipment": ["Bodyweight only", "Pull-up bar"]}},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    answers = response.json()["assessment"]["answers"]
    assert answers["equipment"] == ["Bodyweight only", "Pull-up bar"]
    # Other answers survive the partial update.
    assert answers["exercise_experience"] == "Beginner"


def test_delete_goal_removes_row_and_assessment(client: TestClient, db_session: Session) -> None:
    register(client)
    created = create_goal(
        client,
        name="Temp",
        category="custom",
        assessment={"why_it_matters": "Because", "success_looks_like": "Done"},
    ).json()

    response = client.delete(f"/api/goals/{created['id']}", headers=csrf_headers(client))
    assert response.status_code == 204
    assert client.get(f"/api/goals/{created['id']}").status_code == 404
    assert db_session.query(Goal).filter_by(id=uuid.UUID(created["id"])).one_or_none() is None
    assert (
        db_session.query(GoalAssessment).filter_by(goal_id=uuid.UUID(created["id"])).one_or_none()
        is None
    )


def test_goal_isolation_between_users(client: TestClient, app) -> None:
    alice = TestClient(app)
    bob = TestClient(app)
    try:
        register(alice, email="alice@example.com", display_name="Alice")
        register(bob, email="bob@example.com", display_name="Bob")

        alice_goal = create_goal(alice, name="Alice goal", category="custom").json()

        # Bob cannot read, update, or delete Alice's goal.
        assert bob.get(f"/api/goals/{alice_goal['id']}").status_code == 404
        assert (
            bob.patch(
                f"/api/goals/{alice_goal['id']}",
                json={"name": "Hacked"},
                headers=csrf_headers(bob),
            ).status_code
            == 404
        )
        assert (
            bob.delete(f"/api/goals/{alice_goal['id']}", headers=csrf_headers(bob)).status_code
            == 404
        )
        # Alice's goal is unchanged.
        assert alice.get(f"/api/goals/{alice_goal['id']}").json()["name"] == "Alice goal"
    finally:
        alice.close()
        bob.close()


def test_goals_require_authentication(client: TestClient) -> None:
    prime_csrf(client)
    assert client.get("/api/goals").status_code == 401
    assert create_goal(client).status_code == 401


# --- validation --------------------------------------------------------------


def test_create_goal_rejects_unknown_category(client: TestClient) -> None:
    register(client)
    response = create_goal(client, name="Bad", category="not-a-category")
    assert response.status_code == 422


def test_create_goal_rejects_blank_name(client: TestClient) -> None:
    register(client)
    response = create_goal(client, name="   ", category="custom")
    assert response.status_code == 422


def test_create_goal_rejects_invalid_priority(client: TestClient) -> None:
    register(client)
    response = create_goal(client, name="Bad priority", category="custom", priority="urgent")
    assert response.status_code == 422


def test_create_goal_rejects_invalid_status(client: TestClient) -> None:
    register(client)
    response = create_goal(client, name="Bad status", category="custom", status="in-progress")
    assert response.status_code == 422


def test_create_goal_rejects_past_target_date(client: TestClient) -> None:
    register(client)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    response = create_goal(client, name="Past", category="custom", target_date=yesterday)
    assert response.status_code == 422


def test_create_goal_rejects_unknown_assessment_key(client: TestClient) -> None:
    register(client)
    response = create_goal(
        client, name="Bad key", category="custom", assessment={"nonexistent": "x"}
    )
    assert response.status_code == 422


def test_create_goal_rejects_missing_required_assessment(client: TestClient) -> None:
    register(client)
    response = create_goal(
        client, name="Missing required", category="custom", assessment={"known_constraints": "x"}
    )
    assert response.status_code == 422


def test_create_goal_rejects_invalid_choice_value(client: TestClient) -> None:
    register(client)
    response = create_goal(
        client,
        name="Bad choice",
        category="strength-fitness",
        assessment={
            "exercise_experience": "Expert",  # not in options
            "equipment": ["Bodyweight only"],
            "time_available": "30-45 minutes",
        },
    )
    assert response.status_code == 422


def test_create_goal_rejects_invalid_multiselect_value(client: TestClient) -> None:
    register(client)
    response = create_goal(
        client,
        name="Bad multi",
        category="strength-fitness",
        assessment={
            "exercise_experience": "Beginner",
            "equipment": ["Rocket shoes"],
            "time_available": "30-45 minutes",
        },
    )
    assert response.status_code == 422


def test_duplicate_goal_name_in_category_is_rejected(client: TestClient) -> None:
    register(client)
    first = create_goal(client, name="Same name", category="custom")
    assert first.status_code == 201

    second = create_goal(client, name="Same name", category="custom")
    assert second.status_code == 409


def test_same_name_in_different_category_is_allowed(client: TestClient) -> None:
    register(client)
    first = create_goal(client, name="Same name", category="custom")
    second = create_goal(client, name="Same name", category="academics")
    assert first.status_code == 201
    assert second.status_code == 201


def test_update_goal_rejects_invalid_assessment(client: TestClient) -> None:
    register(client)
    created = create_goal(
        client,
        name="Upd",
        category="strength-fitness",
        assessment={
            "exercise_experience": "Beginner",
            "equipment": ["Bodyweight only"],
            "time_available": "30-45 minutes",
        },
    ).json()
    response = client.patch(
        f"/api/goals/{created['id']}",
        json={"assessment": {"exercise_experience": "Expert"}},
        headers=csrf_headers(client),
    )
    assert response.status_code == 422


# --- onboarding --------------------------------------------------------------


def test_get_onboarding_defaults_for_new_user(client: TestClient) -> None:
    register(client)
    response = client.get("/api/onboarding")
    assert response.status_code == 200
    body = response.json()
    assert body["completed_at"] is None
    assert body["current_step"] is None
    assert body["profile"]["timezone"] is None
    assert "age_range" in body["options"]
    assert "at least one goal" in body["missing"]


def test_save_onboarding_profile_and_lifestyle(client: TestClient, db_session: Session) -> None:
    register(client)
    response = save_onboarding(
        client,
        current_step="lifestyle",
        profile={"timezone": "Europe/London", "daily_availability": "1-2 hours"},
        lifestyle={"schedule": "Student", "planning_style": "Flexible time blocks"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["current_step"] == "lifestyle"
    assert body["profile"]["timezone"] == "Europe/London"
    assert body["lifestyle"]["schedule"] == "Student"

    stored = db_session.query(UserOnboarding).one()
    assert stored.timezone == "Europe/London"
    assert stored.schedule == "Student"


def test_onboarding_partial_saves_merge(client: TestClient) -> None:
    register(client)
    save_onboarding(client, profile={"timezone": "UTC"})
    response = save_onboarding(client, profile={"daily_availability": "2-4 hours"})
    body = response.json()
    assert body["profile"]["timezone"] == "UTC"
    assert body["profile"]["daily_availability"] == "2-4 hours"


def test_onboarding_rejects_invalid_age_range(client: TestClient) -> None:
    register(client)
    response = save_onboarding(client, profile={"age_range": "200"})
    assert response.status_code == 422


def test_onboarding_rejects_invalid_wake_time(client: TestClient) -> None:
    register(client)
    response = save_onboarding(client, profile={"wake_time": "25:00"})
    assert response.status_code == 422


def test_onboarding_rejects_unknown_equipment(client: TestClient) -> None:
    register(client)
    response = save_onboarding(client, lifestyle={"equipment": ["Spaceship"]})
    assert response.status_code == 422


def test_onboarding_requires_authentication(client: TestClient) -> None:
    prime_csrf(client)
    assert client.get("/api/onboarding").status_code == 401
    assert save_onboarding(client, profile={"timezone": "UTC"}).status_code == 401


def test_onboarding_is_isolated_between_users(client: TestClient, app) -> None:
    alice = TestClient(app)
    bob = TestClient(app)
    try:
        register(alice, email="alice@example.com", display_name="Alice")
        register(bob, email="bob@example.com", display_name="Bob")

        save_onboarding(alice, profile={"timezone": "UTC"})

        assert alice.get("/api/onboarding").json()["profile"]["timezone"] == "UTC"
        assert bob.get("/api/onboarding").json()["profile"]["timezone"] is None
    finally:
        alice.close()
        bob.close()


def test_complete_onboarding_requires_a_goal(client: TestClient) -> None:
    register(client)
    response = save_onboarding(
        client,
        profile={"timezone": "UTC", "daily_availability": "1-2 hours"},
        completed=True,
    )
    assert response.status_code == 400
    assert "goal" in response.json()["detail"].lower()


def test_complete_onboarding_requires_timezone(client: TestClient) -> None:
    register(client)
    create_goal(client, name="G", category="custom")
    response = save_onboarding(client, profile={"daily_availability": "1-2 hours"}, completed=True)
    assert response.status_code == 400


def test_complete_onboarding_success(client: TestClient, db_session: Session) -> None:
    register(client)
    create_goal(client, name="G", category="custom")
    response = save_onboarding(
        client,
        profile={"timezone": "UTC", "daily_availability": "1-2 hours"},
        completed=True,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["completed_at"] is not None
    assert body["missing"] == []

    stored = db_session.query(UserOnboarding).one()
    assert stored.completed_at is not None


def test_completing_onboarding_activates_draft_goals(client: TestClient) -> None:
    register(client)
    create_goal(client, name="G", category="custom", status="draft")
    assert client.get("/api/goals").json()[0]["status"] == "draft"

    response = save_onboarding(
        client,
        profile={"timezone": "UTC", "daily_availability": "1-2 hours"},
        completed=True,
    )
    assert response.status_code == 200

    refreshed = client.get("/api/goals").json()
    assert refreshed[0]["status"] == "active"


def test_partial_onboarding_save_keeps_goals_as_draft(client: TestClient) -> None:
    register(client)
    create_goal(client, name="G", category="custom", status="draft")
    save_onboarding(client, current_step="assessment")

    goals = client.get("/api/goals").json()
    assert goals[0]["status"] == "draft"


def test_onboarding_resume_keeps_completed_step(client: TestClient) -> None:
    register(client)
    create_goal(client, name="G", category="custom")
    save_onboarding(client, current_step="goals")
    response = save_onboarding(
        client,
        current_step="review",
        profile={"timezone": "UTC", "daily_availability": "1-2 hours"},
        completed=True,
    )
    assert response.status_code == 200
    assert response.json()["current_step"] == "review"
    assert response.json()["completed_at"] is not None


# --- regression: Phase 2 auth still intact -----------------------------------


def test_auth_and_profile_still_work(client: TestClient) -> None:
    register(client, email="regression@example.com", display_name="Regression")
    assert client.get("/api/auth/me").status_code == 200
    assert client.get("/api/profile").json()["email"] == "regression@example.com"
    assert client.post("/api/auth/logout", headers=csrf_headers(client)).status_code == 200
    assert client.get("/api/auth/me").status_code == 401


# --- regression: writes must survive the request that made them ---------------


def test_goals_and_onboarding_persist_across_request_scoped_sessions() -> None:
    """Writes must commit; a flush alone is rolled back when the session closes.

    The shared test session masks missing commits because every request in a
    test sees the same open transaction. In production (app.db.session) each
    request gets a *fresh* session that is closed without committing, so a
    service that only flushes silently loses the write. This test reproduces
    that lifecycle: one short-lived session per request, closed with no commit.

    It uses its own throwaway engine because, unlike the rollback-isolated
    ``db_session`` fixture, these sessions commit for real.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    from app.db.base import Base

    isolated_engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(isolated_engine)
    request_scoped = sessionmaker(
        bind=isolated_engine, autoflush=False, autocommit=False, expire_on_commit=False
    )

    def _per_request_session() -> Iterator[Session]:
        session = request_scoped()
        try:
            yield session
        finally:
            session.close()  # like production: no commit here

    application = create_app()
    application.dependency_overrides[get_session] = _per_request_session
    with TestClient(application) as scoped_client:
        register(scoped_client)

        created = create_goal(scoped_client, name="Persist me", category="custom")
        assert created.status_code == 201

        # A brand-new session (a later request) must see the created goal.
        listed = scoped_client.get("/api/goals")
        assert [goal["name"] for goal in listed.json()] == ["Persist me"]

        saved = save_onboarding(scoped_client, current_step="goals")
        assert saved.status_code == 200
        assert scoped_client.get("/api/onboarding").json()["current_step"] == "goals"

        # Completion must also survive: it activates drafts in the same commit.
        create_goal(scoped_client, name="Second", category="sleep-consistency")
        completed = save_onboarding(
            scoped_client,
            current_step="review",
            profile={"timezone": "UTC", "daily_availability": "1-2 hours"},
            completed=True,
        )
        assert completed.status_code == 200
        assert completed.json()["completed_at"] is not None
        statuses = {goal["name"]: goal["status"] for goal in scoped_client.get("/api/goals").json()}
        assert statuses == {"Persist me": "active", "Second": "active"}
