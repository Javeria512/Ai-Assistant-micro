"""Tasks from Microsoft To Do and Planner, merged into one model."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import Dict, List, Optional

from app.core.config import get_settings
from app.integrations.microsoft import endpoints
from app.integrations.microsoft.mappers import map_planner_task, map_todo_list, map_todo_task
from app.schemas.task import TaskItem, TaskList, TaskSource, TaskSummary
from app.services.base import GraphService
from app.utils.datetime_utils import day_bounds, ensure_aware, utcnow

logger = logging.getLogger(__name__)
settings = get_settings()

# Fetching every To Do list serially is slow; cap the fan-out instead.
MAX_TODO_LISTS = 12


class TaskService(GraphService):
    async def get_lists(self) -> List[TaskList]:
        payloads, warning = await self.client.try_get_collection(
            endpoints.ME_TODO_LISTS, params={"$top": 50}, max_items=50
        )
        self._warn(warning)
        return [map_todo_list(payload) for payload in payloads]

    async def _get_todo_tasks(self) -> List[TaskItem]:
        lists = await self.get_lists()
        if not lists:
            return []

        now = utcnow()

        async def fetch(task_list: TaskList) -> List[TaskItem]:
            payloads, warning = await self.client.try_get_collection(
                endpoints.ME_TODO_TASKS.format(list_id=task_list.id),
                params={"$select": endpoints.TODO_TASK_SELECT, "$top": 100},
                max_items=settings.TASK_FETCH_LIMIT,
            )
            if warning:
                self._warn(warning)
            return [
                map_todo_task(
                    payload,
                    list_id=task_list.id,
                    list_name=task_list.name,
                    now=now,
                )
                for payload in payloads
            ]

        results = await asyncio.gather(
            *(fetch(task_list) for task_list in lists[:MAX_TODO_LISTS]),
            return_exceptions=True,
        )

        tasks: List[TaskItem] = []
        for result in results:
            if isinstance(result, BaseException):
                logger.warning("A To Do list could not be read: %s", result)
                self._warn("Some Microsoft To Do lists could not be read.")
                continue
            tasks.extend(result)
        return tasks

    async def _get_planner_tasks(self) -> List[TaskItem]:
        payloads, warning = await self.client.try_get_collection(
            endpoints.ME_PLANNER_TASKS,
            params={"$top": 100},
            max_items=settings.TASK_FETCH_LIMIT,
        )
        if warning:
            # Planner is commonly not licensed/consented - degrade quietly.
            logger.info("Planner tasks unavailable: %s", warning)
            return []

        now = utcnow()
        return [
            map_planner_task(payload, tenant_id=self.user.ms_tenant_id, now=now)
            for payload in payloads
        ]

    async def get_tasks(
        self,
        *,
        include_completed: bool = False,
        sources: Optional[List[TaskSource]] = None,
    ) -> List[TaskItem]:
        """All tasks across To Do and Planner."""
        wanted = set(sources or [TaskSource.TODO, TaskSource.PLANNER])
        jobs = []
        if TaskSource.TODO in wanted:
            jobs.append(self._get_todo_tasks())
        if TaskSource.PLANNER in wanted:
            jobs.append(self._get_planner_tasks())

        results = await asyncio.gather(*jobs, return_exceptions=True)
        tasks: List[TaskItem] = []
        for result in results:
            if isinstance(result, BaseException):
                logger.warning("Task source failed: %s", result)
                self._warn("A task source could not be read.")
                continue
            tasks.extend(result)

        if not include_completed:
            tasks = [task for task in tasks if not task.is_completed]
        return self.sort_tasks(tasks)

    async def get_pending(self, *, limit: Optional[int] = None) -> List[TaskItem]:
        tasks = await self.get_tasks(include_completed=False)
        return tasks[:limit] if limit else tasks

    # --------------------------------------------------------------- processing
    @staticmethod
    def sort_tasks(tasks: List[TaskItem]) -> List[TaskItem]:
        """Overdue first, then soonest due, then undated by importance."""
        importance_rank = {"high": 0, "normal": 1, "low": 2}

        def key(task: TaskItem):
            has_due = task.due_at is not None
            return (
                0 if task.is_overdue else 1,
                0 if has_due else 1,
                task.days_until_due if has_due else 0.0,
                importance_rank.get(task.importance, 1),
                task.title.lower(),
            )

        return sorted(tasks, key=key)

    def summarize(self, tasks: List[TaskItem]) -> TaskSummary:
        now = utcnow()
        today_start, today_end = day_bounds(now, self.timezone)
        week_end = today_start + timedelta(days=7)

        summary = TaskSummary(total=len(tasks))
        for task in tasks:
            if task.importance == "high":
                summary.high_importance += 1
            if task.status == "inProgress":
                summary.in_progress += 1

            due = ensure_aware(task.due_at)
            if due is None:
                summary.no_due_date += 1
                continue
            if task.is_overdue:
                summary.overdue += 1
            if today_start <= due < today_end:
                summary.due_today += 1
            if now <= due < week_end:
                summary.due_this_week += 1
        return summary

    @staticmethod
    def group_by_list(tasks: List[TaskItem]) -> Dict[str, List[TaskItem]]:
        grouped: Dict[str, List[TaskItem]] = {}
        for task in tasks:
            grouped.setdefault(task.list_name or "Other", []).append(task)
        return grouped
