"""Database access for roadmaps.

Like :class:`~app.repositories.goal_repository.GoalRepository`, every read is
scoped to a user id; there is no "get by id alone" helper. A roadmap belonging
to another user is therefore indistinguishable from one that does not exist.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.roadmap import Roadmap, RoadmapMilestone, RoadmapResource, RoadmapTask


class RoadmapRepository:
    """Persistence operations for roadmaps and their nested content."""

    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _detail_statement() -> Select[tuple[Roadmap]]:
        return select(Roadmap).options(
            selectinload(Roadmap.goal),
            selectinload(Roadmap.milestones).selectinload(RoadmapMilestone.tasks),
            selectinload(Roadmap.milestones).selectinload(RoadmapMilestone.resources),
        )

    def list_for_user(self, user_id: uuid.UUID) -> list[Roadmap]:
        statement = (
            self._detail_statement()
            .where(Roadmap.user_id == user_id)
            .order_by(Roadmap.created_at.desc(), Roadmap.id.desc())
        )
        return list(self._session.execute(statement).scalars())

    def get_for_user(self, user_id: uuid.UUID, roadmap_id: uuid.UUID) -> Roadmap | None:
        statement = self._detail_statement().where(
            Roadmap.user_id == user_id,
            Roadmap.id == roadmap_id,
        )
        return self._session.execute(statement).scalar_one_or_none()

    def get_by_generation_key(self, user_id: uuid.UUID, key: str) -> Roadmap | None:
        statement = self._detail_statement().where(
            Roadmap.user_id == user_id,
            Roadmap.generation_key == key,
        )
        return self._session.execute(statement).scalar_one_or_none()

    def get_active_for_goal(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> Roadmap | None:
        statement = self._detail_statement().where(
            Roadmap.user_id == user_id,
            Roadmap.goal_id == goal_id,
            Roadmap.status == "active",
        )
        return self._session.execute(statement).scalar_one_or_none()

    def create(
        self,
        *,
        user_id: uuid.UUID,
        goal_id: uuid.UUID,
        provider: str,
        model: str,
        generation_key: str | None,
        content: dict[str, Any],
    ) -> Roadmap:
        """Persist a previously validated roadmap and its nested content."""
        roadmap = Roadmap(
            user_id=user_id,
            goal_id=goal_id,
            title=content["title"],
            description=content["description"],
            objective=content["objective"],
            starting_level=content["starting_level"],
            target_level=content["target_level"],
            estimated_duration_weeks=content["estimated_duration_weeks"],
            status="draft",
            provider=provider,
            model=model,
            generation_key=generation_key,
        )

        for milestone_position, milestone_data in enumerate(content["milestones"]):
            milestone = RoadmapMilestone(
                user_id=user_id,
                position=milestone_position,
                title=milestone_data["title"],
                description=milestone_data["description"],
                estimated_duration_weeks=milestone_data["estimated_duration_weeks"],
                completion_criteria=milestone_data["completion_criteria"],
                status="pending",
            )
            for task_position, task_data in enumerate(milestone_data["tasks"]):
                milestone.tasks.append(
                    RoadmapTask(
                        user_id=user_id,
                        position=task_position,
                        title=task_data["title"],
                        description=task_data["description"],
                        estimated_minutes=task_data["estimated_minutes"],
                        completion_criteria=task_data["completion_criteria"],
                        status="pending",
                    )
                )
            for resource_position, resource_data in enumerate(milestone_data.get("resources", [])):
                milestone.resources.append(
                    RoadmapResource(
                        user_id=user_id,
                        position=resource_position,
                        title=resource_data["title"],
                        resource_type=resource_data["resource_type"],
                        url=resource_data.get("url"),
                        note=resource_data.get("note"),
                    )
                )
            roadmap.milestones.append(milestone)

        self._session.add(roadmap)
        self._session.flush()
        return roadmap

    def approve(self, roadmap: Roadmap) -> Roadmap:
        """Make ``roadmap`` the active plan for its goal.

        Any other active roadmap for the same goal is archived, never deleted:
        the previous plan stays viewable and can be reactivated later.
        """
        now = datetime.now(UTC)
        self._session.execute(
            update(Roadmap)
            .where(
                Roadmap.user_id == roadmap.user_id,
                Roadmap.goal_id == roadmap.goal_id,
                Roadmap.status == "active",
                Roadmap.id != roadmap.id,
            )
            .values(status="archived", updated_at=func.now())
        )
        roadmap.status = "active"
        roadmap.approved_at = now
        self._session.flush()
        return roadmap
