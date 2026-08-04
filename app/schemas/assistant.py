"""Aggregated assistant-level schemas (daily brief, user summary)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from app.schemas.calendar import CalendarEvent, MeetingConflict
from app.schemas.chat import Conversation
from app.schemas.common import BaseSchema
from app.schemas.mail import EmailMessage
from app.schemas.priority import PriorityItem
from app.schemas.task import TaskItem, TaskSummary
from app.schemas.user import UserProfile
from app.utils.datetime_utils import utcnow


class WorkloadStats(BaseSchema):
    """The numbers behind the summary; also fed to the LLM as grounding."""

    meetings_today: int = 0
    meeting_minutes_today: float = 0.0
    meeting_conflicts: int = 0
    next_meeting_in_minutes: Optional[float] = None

    unread_emails: int = 0
    important_emails: int = 0
    emails_awaiting_reply: int = 0

    pending_tasks: int = 0
    overdue_tasks: int = 0
    tasks_due_today: int = 0

    unread_conversations: int = 0
    conversations_waiting_on_me: int = 0

    critical_items: int = 0
    high_priority_items: int = 0


class UserSummary(BaseSchema):
    """The 'what does my day look like' response."""

    generated_at: datetime = Field(default_factory=utcnow)
    timezone: str = "UTC"
    profile: UserProfile
    greeting: str
    headline: str = Field(description="One-line status of the day.")
    highlights: List[str] = Field(
        default_factory=list, description="Bullet points a manager can scan in seconds."
    )
    recommended_focus: List[PriorityItem] = Field(
        default_factory=list, description="Top-ranked items to act on now."
    )
    stats: WorkloadStats = Field(default_factory=WorkloadStats)
    narrative: Optional[str] = Field(
        default=None, description="Prose summary; LLM-written when a provider is configured."
    )
    ai_generated: bool = False
    warnings: List[str] = Field(default_factory=list)


class DailyBrief(BaseSchema):
    """Everything the dashboard needs in a single round-trip."""

    generated_at: datetime = Field(default_factory=utcnow)
    timezone: str = "UTC"
    date: str

    profile: UserProfile
    greeting: str
    headline: str

    meetings: List[CalendarEvent] = Field(default_factory=list)
    conflicts: List[MeetingConflict] = Field(default_factory=list)
    pending_tasks: List[TaskItem] = Field(default_factory=list)
    task_summary: TaskSummary = Field(default_factory=TaskSummary)
    important_emails: List[EmailMessage] = Field(default_factory=list)
    important_conversations: List[Conversation] = Field(default_factory=list)
    priorities: List[PriorityItem] = Field(default_factory=list)

    stats: WorkloadStats = Field(default_factory=WorkloadStats)
    narrative: Optional[str] = None
    ai_generated: bool = False
    warnings: List[str] = Field(
        default_factory=list,
        description="Sources that failed or were unavailable; the brief degrades rather than 500s.",
    )
