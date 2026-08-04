"""Task schemas covering both Microsoft To Do and Planner."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema


class TaskSource(str, Enum):
    TODO = "todo"
    PLANNER = "planner"


class TaskList(BaseSchema):
    id: str
    name: str
    source: TaskSource = TaskSource.TODO
    is_default: bool = False
    is_shared: bool = False


class TaskItem(BaseSchema):
    id: str
    source: TaskSource
    title: str = "(untitled task)"
    notes: str = ""

    list_id: Optional[str] = None
    list_name: Optional[str] = None
    plan_id: Optional[str] = None
    bucket_id: Optional[str] = None

    status: str = "notStarted"
    importance: str = "normal"
    percent_complete: int = 0
    is_completed: bool = False

    created_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    is_overdue: bool = False
    days_until_due: Optional[float] = None
    has_due_date: bool = False
    web_link: Optional[str] = None
    created_by: Optional[str] = None
    categories: List[str] = Field(default_factory=list)


class TaskSummary(BaseSchema):
    total: int = 0
    overdue: int = 0
    due_today: int = 0
    due_this_week: int = 0
    no_due_date: int = 0
    high_importance: int = 0
    in_progress: int = 0
