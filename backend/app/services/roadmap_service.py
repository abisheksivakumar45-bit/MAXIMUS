"""Roadmap business logic.

The service owns the generation flow:

1. resolve the goal through the user-scoped repository (404 on anything else),
2. return an existing roadmap when an idempotency key is replayed,
3. refuse to run when no AI provider is configured (never fake output),
4. build a bounded, injection-aware prompt from the user's real data,
5. call the provider and receive a strictly validated Pydantic object,
6. persist the roadmap only after validation succeeds, and commit.

A provider failure therefore leaves no partial or corrupted record behind.
"""

from __future__ import annotations

import logging
import threading
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.prompts import build_roadmap_prompts
from app.ai.provider import AIConfigurationError, AIProvider
from app.ai.schemas import GeneratedRoadmap
from app.models.goal import Goal
from app.models.roadmap import Roadmap
from app.models.user import User
from app.repositories.goal_repository import GoalRepository
from app.repositories.onboarding_repository import OnboardingRepository
from app.repositories.roadmap_repository import RoadmapRepository
from app.schemas.roadmap import RoadmapGenerateRequest
from app.services.goal_service import GoalNotFoundError

logger = logging.getLogger(__name__)

#: Goals a roadmap may be generated for. Draft goals have not been approved by
#: onboarding yet; completed/archived goals no longer need a plan.
GENERATABLE_GOAL_STATUSES = frozenset({"active", "paused"})


class RoadmapError(Exception):
    """Base class for roadmap failures."""


class RoadmapNotFoundError(RoadmapError):
    """Raised when a roadmap does not exist or belongs to another user."""


class GoalNotEligibleError(RoadmapError):
    """Raised when the goal's status does not allow roadmap generation."""


class IdempotencyConflictError(RoadmapError):
    """Raised when an idempotency key was already used for a different goal."""


class GenerationInProgressError(RoadmapError):
    """Raised when the same generation is already running in this process."""


class _GenerationGuard:
    """Best-effort in-process de-duplication of concurrent paid AI calls.

    The database unique constraint on ``(user_id, generation_key)`` is the real
    guarantee; this guard just avoids a second provider call (and a second
    invoice) when a user double-submits before either request has committed.
    """

    def __init__(self) -> None:
        self._mutex = threading.Lock()
        self._locks: dict[str, threading.Lock] = {}

    def acquire(self, key: str) -> bool:
        with self._mutex:
            lock = self._locks.setdefault(key, threading.Lock())
            return lock.acquire(blocking=False)

    def release(self, key: str) -> None:
        with self._mutex:
            lock = self._locks.get(key)
        if lock is not None and lock.locked():
            lock.release()


_generation_guard = _GenerationGuard()


class RoadmapService:
    """Coordinates roadmap generation and approval for one user."""

    def __init__(self, session: Session, provider: AIProvider) -> None:
        self._session = session
        self._provider = provider
        self._roadmaps = RoadmapRepository(session)
        self._goals = GoalRepository(session)
        self._onboarding = OnboardingRepository(session)

    # -- reads ---------------------------------------------------------------
    def list_roadmaps(self, user_id: uuid.UUID) -> list[Roadmap]:
        return self._roadmaps.list_for_user(user_id)

    def get_roadmap(self, user_id: uuid.UUID, roadmap_id: uuid.UUID) -> Roadmap:
        roadmap = self._roadmaps.get_for_user(user_id, roadmap_id)
        if roadmap is None:
            raise RoadmapNotFoundError
        return roadmap

    # -- writes --------------------------------------------------------------
    def generate(self, user: User, payload: RoadmapGenerateRequest) -> tuple[Roadmap, bool]:
        """Generate and persist a roadmap.

        Returns ``(roadmap, created)``. ``created`` is False when the request
        replayed an idempotency key, so the route can answer 200 instead of 201.
        """
        goal = self._goals.get_for_user(user.id, payload.goal_id)
        if goal is None:
            raise GoalNotFoundError

        if payload.idempotency_key is not None:
            existing = self._roadmaps.get_by_generation_key(user.id, payload.idempotency_key)
            if existing is not None:
                if existing.goal_id != goal.id:
                    raise IdempotencyConflictError(
                        "This idempotency key belongs to a different goal."
                    )
                return existing, False

        self._ensure_eligible(goal)
        if not self._provider.is_configured:
            raise AIConfigurationError(self._provider.configuration_message())

        guard_key = f"{user.id}:{payload.idempotency_key or goal.id}"
        if not _generation_guard.acquire(guard_key):
            raise GenerationInProgressError(
                "A roadmap is already being generated for this goal. Please wait."
            )
        try:
            # Re-check after acquiring: another request may have committed while
            # this one waited for the guard.
            if payload.idempotency_key is not None:
                existing = self._roadmaps.get_by_generation_key(user.id, payload.idempotency_key)
                if existing is not None:
                    if existing.goal_id != goal.id:
                        raise IdempotencyConflictError(
                            "This idempotency key belongs to a different goal."
                        )
                    return existing, False

            onboarding = self._onboarding.get_for_user(user.id)
            system_prompt, user_prompt = build_roadmap_prompts(goal=goal, onboarding=onboarding)
            generated = self._provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=GeneratedRoadmap,
            )
            return self._persist(user.id, goal.id, payload, generated), True
        except IntegrityError:
            # A concurrent request with the same key won the unique constraint.
            self._session.rollback()
            if payload.idempotency_key is not None:
                existing = self._roadmaps.get_by_generation_key(user.id, payload.idempotency_key)
                if existing is not None:
                    return existing, False
            raise
        finally:
            _generation_guard.release(guard_key)

    def approve(self, user_id: uuid.UUID, roadmap_id: uuid.UUID) -> Roadmap:
        """Approve a roadmap, making it the active plan for its goal.

        Idempotent: approving an already-active roadmap returns it unchanged.
        """
        roadmap = self.get_roadmap(user_id, roadmap_id)
        if roadmap.status != "active":
            self._roadmaps.approve(roadmap)
            self._session.commit()
        return roadmap

    # -- internals -----------------------------------------------------------
    @staticmethod
    def _ensure_eligible(goal: Goal) -> None:
        if goal.status not in GENERATABLE_GOAL_STATUSES:
            raise GoalNotEligibleError(
                "Activate this goal before generating a roadmap. Draft, completed, "
                "and archived goals cannot be planned."
            )

    def _persist(
        self,
        user_id: uuid.UUID,
        goal_id: uuid.UUID,
        payload: RoadmapGenerateRequest,
        generated: GeneratedRoadmap,
    ) -> Roadmap:
        roadmap = self._roadmaps.create(
            user_id=user_id,
            goal_id=goal_id,
            provider=self._provider.name,
            model=self._provider.model or "unknown",
            generation_key=payload.idempotency_key,
            content=generated.model_dump(),
        )
        # Commit like every other write path. The request-scoped session is
        # closed without committing, so a flush alone would silently roll back.
        self._session.commit()
        logger.info(
            "Roadmap generated roadmap_id=%s goal_id=%s milestones=%d provider=%s",
            roadmap.id,
            goal_id,
            len(roadmap.milestones),
            self._provider.name,
        )
        return roadmap
