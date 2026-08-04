"""Task endpoints (Microsoft To Do + Planner)."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_task_service
from app.schemas.common import Collection
from app.schemas.task import TaskItem, TaskList, TaskSource, TaskSummary
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get(
    "/pending",
    response_model=Collection[TaskItem],
    summary="Pending tasks",
)
async def list_pending_tasks(
    limit: int = Query(50, ge=1, le=200),
    service: TaskService = Depends(get_task_service),
) -> Collection[TaskItem]:
    """Open tasks across every To Do list and Planner plan.

    Ordered overdue first, then by due date, then by importance.
    """
    tasks = await service.get_pending(limit=limit)
    return Collection.of(tasks, service.warnings)


@router.get("", response_model=Collection[TaskItem], summary="List tasks")
async def list_tasks(
    include_completed: bool = Query(False),
    sources: Optional[List[TaskSource]] = Query(
        None, description="Restrict to 'todo' and/or 'planner'."
    ),
    service: TaskService = Depends(get_task_service),
) -> Collection[TaskItem]:
    tasks = await service.get_tasks(include_completed=include_completed, sources=sources)
    return Collection.of(tasks, service.warnings)


@router.get("/lists", response_model=Collection[TaskList], summary="To Do lists")
async def list_task_lists(
    service: TaskService = Depends(get_task_service),
) -> Collection[TaskList]:
    lists = await service.get_lists()
    return Collection.of(lists, service.warnings)


@router.get("/summary", response_model=TaskSummary, summary="Task counters")
async def task_summary(service: TaskService = Depends(get_task_service)) -> TaskSummary:
    tasks = await service.get_tasks()
    return service.summarize(tasks)
