"""Cross-source aggregation: daily brief, user summary, unified priorities.

This is the only place that talks to every domain service at once. All Graph
calls fan out concurrently and every source degrades independently - one failing
API adds a warning instead of breaking the dashboard.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Set, TypeVar

import httpx

from app.ai.base import LLMProvider, system_message, user_message
from app.ai.factory import get_llm_provider
from app.ai.prompts.templates import EXECUTIVE_ASSISTANT_SYSTEM, build_daily_brief_prompt
from app.ai.reranker import LLMPriorityReranker
from app.core.config import get_settings
from app.integrations.microsoft.graph_client import GraphClient
from app.models.user import User
from app.schemas.assistant import DailyBrief, UserSummary, WorkloadStats
from app.schemas.calendar import DailyAgenda
from app.schemas.chat import Conversation
from app.schemas.common import PriorityBucket, SourceType
from app.schemas.mail import EmailMessage
from app.schemas.priority import PriorityList
from app.schemas.task import TaskItem, TaskSummary
from app.schemas.user import UserProfile
from app.services.base import GraphService
from app.services.calendar_service import CalendarService
from app.services.chat_service import ChatService
from app.services.mail_service import MailService
from app.services.priority.engine import PriorityEngine
from app.services.priority.signals import PriorityContext, build_frequent_contacts
from app.services.profile_service import ProfileService
from app.services.task_service import TaskService
from app.utils.datetime_utils import humanize_delta, to_tzinfo, utcnow
from app.utils.text import initials

logger = logging.getLogger(__name__)
settings = get_settings()

T = TypeVar("T")


@dataclass
class ActivitySnapshot:
    """One consistent view of the user's day, shared by every aggregate endpoint."""

    profile: UserProfile
    emails: List[EmailMessage] = field(default_factory=list)
    agenda: Optional[DailyAgenda] = None
    tasks: List[TaskItem] = field(default_factory=list)
    task_summary: TaskSummary = field(default_factory=TaskSummary)
    conversations: List[Conversation] = field(default_factory=list)
    replied_thread_keys: Set[str] = field(default_factory=set)
    unread_email_count: int = 0
    warnings: List[str] = field(default_factory=list)

    @property
    def meetings(self) -> List:
        return self.agenda.events if self.agenda else []


class AssistantService(GraphService):
    """Aggregates every source and produces the assistant-level responses."""

    def __init__(
        self,
        client: GraphClient,
        user: User,
        *,
        http_client: Optional[httpx.AsyncClient] = None,
        llm: Optional[LLMProvider] = None,
    ) -> None:
        super().__init__(client, user)
        self.profile_service = ProfileService(client, user)
        self.mail_service = MailService(client, user)
        self.calendar_service = CalendarService(client, user)
        self.task_service = TaskService(client, user)
        self.chat_service = ChatService(client, user)
        self.llm = llm or get_llm_provider(http_client)

    # ---------------------------------------------------------------- helpers
    def _unwrap(self, result: Any, default: T, label: str) -> T:
        if isinstance(result, BaseException):
            logger.warning("%s could not be loaded: %s", label, result)
            self._warn(f"{label} is temporarily unavailable.")
            return default
        return result

    def _collect_service_warnings(self) -> None:
        for service in (
            self.profile_service,
            self.mail_service,
            self.calendar_service,
            self.task_service,
            self.chat_service,
        ):
            for warning in service.warnings:
                self._warn(warning)

    def _fallback_profile(self) -> UserProfile:
        return UserProfile(
            id=self.user.id,
            ms_object_id=self.user.ms_object_id,
            display_name=self.user.display_name,
            given_name=self.user.given_name,
            email=self.user.email,
            user_principal_name=self.user.user_principal_name,
            job_title=self.user.job_title,
            department=self.user.department,
            timezone=self.timezone,
            initials=initials(self.user.display_name),
            last_login_at=self.user.last_login_at,
        )

    # --------------------------------------------------------------- gathering
    async def collect(self, *, include_chats: bool = True) -> ActivitySnapshot:
        """Fetch every source concurrently; never fail because one source did."""

        async def no_chats() -> List[Conversation]:
            return []

        async def unread_count() -> int:
            try:
                return await self.mail_service.get_unread_count()
            except Exception:  # noqa: BLE001 - purely informational
                return 0

        results = await asyncio.gather(
            self.profile_service.get_profile(),
            self.mail_service.list_messages(limit=settings.MAIL_FETCH_LIMIT),
            self.mail_service.get_recently_sent_conversation_ids(),
            self.calendar_service.get_today(),
            self.task_service.get_tasks(),
            self.chat_service.get_conversations() if include_chats else no_chats(),
            unread_count(),
            return_exceptions=True,
        )

        profile = self._unwrap(results[0], self._fallback_profile(), "Microsoft profile")
        emails: List[EmailMessage] = self._unwrap(results[1], [], "Outlook mail")
        replied: Set[str] = self._unwrap(results[2], set(), "Sent items")
        agenda: Optional[DailyAgenda] = self._unwrap(results[3], None, "Calendar")
        tasks: List[TaskItem] = self._unwrap(results[4], [], "Tasks")
        conversations: List[Conversation] = self._unwrap(results[5], [], "Teams chats")
        unread = self._unwrap(results[6], 0, "Mailbox counters")

        self._collect_service_warnings()

        return ActivitySnapshot(
            profile=profile,
            emails=emails,
            agenda=agenda,
            tasks=tasks,
            task_summary=self.task_service.summarize(tasks),
            conversations=conversations,
            replied_thread_keys=replied,
            unread_email_count=unread or sum(1 for item in emails if not item.is_read),
            warnings=list(self.warnings),
        )

    def build_context(self, snapshot: ActivitySnapshot) -> PriorityContext:
        vip = set(settings.vip_contacts) | {
            item.lower() for item in (self.user.vip_contacts or [])
        }
        return PriorityContext(
            now=utcnow(),
            timezone=self.timezone,
            user_addresses=set(self.identity.addresses),
            user_object_id=self.user.ms_object_id,
            vip_contacts=vip,
            frequent_contacts=build_frequent_contacts(snapshot.emails),
            replied_thread_keys=snapshot.replied_thread_keys,
        )

    def build_engine(self, *, use_ai: bool = False) -> PriorityEngine:
        reranker = (
            LLMPriorityReranker(self.llm) if use_ai and self.llm.available else None
        )
        return PriorityEngine(
            weight_overrides=self.user.priority_weights or {}, reranker=reranker
        )

    # -------------------------------------------------------------- priorities
    async def get_priorities(
        self,
        *,
        limit: Optional[int] = None,
        sources: Optional[Sequence[SourceType]] = None,
        use_ai: bool = False,
        snapshot: Optional[ActivitySnapshot] = None,
    ) -> PriorityList:
        """The Single Unified Priority list across every connected system."""
        wanted = set(sources or list(SourceType))
        snapshot = snapshot or await self.collect(include_chats=SourceType.CHAT in wanted)
        context = self.build_context(snapshot)
        engine = self.build_engine(use_ai=use_ai)

        return await engine.build(
            context,
            emails=snapshot.emails if SourceType.EMAIL in wanted else None,
            meetings=snapshot.meetings if SourceType.MEETING in wanted else None,
            tasks=snapshot.tasks if SourceType.TASK in wanted else None,
            conversations=snapshot.conversations if SourceType.CHAT in wanted else None,
            limit=limit,
            warnings=snapshot.warnings,
        )

    # ------------------------------------------------- important sub-selections
    @staticmethod
    def _take_important(
        scored: List[tuple], limit: int, *, minimum_bucket: PriorityBucket = PriorityBucket.MEDIUM
    ) -> List[Any]:
        """Prefer non-trivial items, but never return an empty list needlessly."""
        order = {
            PriorityBucket.CRITICAL: 3,
            PriorityBucket.HIGH: 2,
            PriorityBucket.MEDIUM: 1,
            PriorityBucket.LOW: 0,
        }
        floor = order[minimum_bucket]
        scored.sort(key=lambda pair: pair[0].score, reverse=True)

        selected = [original for item, original in scored if order[item.bucket] >= floor]
        if len(selected) < min(3, len(scored)):
            selected = [original for _, original in scored]
        return selected[:limit]

    async def get_important_emails(
        self, *, limit: int = 10, snapshot: Optional[ActivitySnapshot] = None
    ) -> List[EmailMessage]:
        snapshot = snapshot or await self.collect(include_chats=False)
        context = self.build_context(snapshot)
        engine = self.build_engine()

        scored = [
            (engine.score_email(message, context), message)
            for message in snapshot.emails
            if not message.is_draft
        ]
        return self._take_important(scored, limit)

    async def get_important_conversations(
        self, *, limit: int = 10, snapshot: Optional[ActivitySnapshot] = None
    ) -> List[Conversation]:
        snapshot = snapshot or await self.collect()
        context = self.build_context(snapshot)
        engine = self.build_engine()

        scored = [
            (engine.score_conversation(conversation, context), conversation)
            for conversation in snapshot.conversations
        ]
        return self._take_important(scored, limit)

    # ------------------------------------------------------------- statistics
    def build_stats(
        self, snapshot: ActivitySnapshot, priorities: Optional[PriorityList] = None
    ) -> WorkloadStats:
        agenda = snapshot.agenda
        next_meeting = agenda.next_meeting if agenda else None

        awaiting = sum(
            1
            for message in snapshot.emails
            if self.mail_service.awaiting_reply(message, snapshot.replied_thread_keys)
        )
        important = sum(
            1
            for message in snapshot.emails
            if message.importance == "high" or message.is_flagged
        )

        stats = WorkloadStats(
            meetings_today=agenda.total_meetings if agenda else 0,
            meeting_minutes_today=agenda.total_meeting_minutes if agenda else 0.0,
            meeting_conflicts=len(agenda.conflicts) if agenda else 0,
            next_meeting_in_minutes=(
                next_meeting.starts_in_minutes if next_meeting else None
            ),
            unread_emails=snapshot.unread_email_count,
            important_emails=important,
            emails_awaiting_reply=awaiting,
            pending_tasks=snapshot.task_summary.total,
            overdue_tasks=snapshot.task_summary.overdue,
            tasks_due_today=snapshot.task_summary.due_today,
            unread_conversations=sum(
                1 for conversation in snapshot.conversations if conversation.is_unread
            ),
            conversations_waiting_on_me=sum(
                1 for conversation in snapshot.conversations if conversation.waiting_on_me
            ),
        )
        if priorities is not None:
            stats.critical_items = priorities.buckets.critical
            stats.high_priority_items = priorities.buckets.high
        return stats

    # ---------------------------------------------------------------- narrative
    def _greeting(self) -> str:
        local_hour = utcnow().astimezone(to_tzinfo(self.timezone)).hour
        if local_hour < 12:
            part = "Good morning"
        elif local_hour < 17:
            part = "Good afternoon"
        else:
            part = "Good evening"
        name = self.user.given_name or (self.user.display_name or "").split(" ")[0]
        return f"{part}, {name}".strip().rstrip(",") if name else part

    @staticmethod
    def _headline(stats: WorkloadStats) -> str:
        parts: List[str] = []
        if stats.meetings_today:
            hours = round(stats.meeting_minutes_today / 60.0, 1)
            parts.append(
                f"{stats.meetings_today} meeting{'s' if stats.meetings_today != 1 else ''} "
                f"({hours}h)"
            )
        if stats.overdue_tasks:
            suffix = "s" if stats.overdue_tasks != 1 else ""
            parts.append(f"{stats.overdue_tasks} overdue task{suffix}")
        elif stats.tasks_due_today:
            parts.append(f"{stats.tasks_due_today} task(s) due today")
        if stats.emails_awaiting_reply:
            parts.append(f"{stats.emails_awaiting_reply} email(s) awaiting your reply")
        if stats.conversations_waiting_on_me:
            parts.append(
                f"{stats.conversations_waiting_on_me} chat(s) waiting on you"
            )

        if not parts:
            return "Your day looks clear - nothing urgent is waiting."
        return "Today: " + ", ".join(parts) + "."

    def _highlights(
        self, snapshot: ActivitySnapshot, priorities: PriorityList
    ) -> List[str]:
        highlights: List[str] = []
        agenda = snapshot.agenda

        if agenda and agenda.next_meeting:
            meeting = agenda.next_meeting
            highlights.append(
                f"Next meeting: {meeting.subject} "
                f"{humanize_delta(meeting.start, utcnow())}."
            )
        if agenda and agenda.conflicts:
            first = agenda.conflicts[0]
            highlights.append(
                f"Schedule conflict: {first.first.subject} overlaps {first.second.subject}."
            )
        if snapshot.task_summary.overdue:
            highlights.append(
                f"{snapshot.task_summary.overdue} task(s) are past their due date."
            )
        for item in priorities.items[:2]:
            highlights.append(f"{item.action_hint or 'Handle'}: {item.title}.")
        return highlights[:5]

    async def _narrative(
        self,
        snapshot: ActivitySnapshot,
        stats: WorkloadStats,
        priorities: PriorityList,
    ) -> Optional[str]:
        """LLM-written summary; ``None`` when no provider is configured."""
        if not self.llm.available:
            return None

        payload: Dict[str, Any] = {
            "now": utcnow().isoformat(),
            "timezone": self.timezone,
            "user": {
                "name": snapshot.profile.display_name,
                "job_title": snapshot.profile.job_title,
            },
            "stats": stats.model_dump(),
            "top_priorities": [
                {
                    "title": item.title,
                    "source": item.source.value,
                    "score": item.score,
                    "due_at": item.due_at.isoformat() if item.due_at else None,
                    "reasons": item.reasons,
                }
                for item in priorities.items[:8]
            ],
            "meetings": [
                {
                    "subject": event.subject,
                    "start": event.start.isoformat() if event.start else None,
                    "minutes_until_start": event.starts_in_minutes,
                    "attendees": event.attendee_count,
                }
                for event in snapshot.meetings[:8]
            ],
        }

        try:
            return await self.llm.complete(
                [
                    system_message(EXECUTIVE_ASSISTANT_SYSTEM),
                    user_message(build_daily_brief_prompt(payload)),
                ],
                temperature=0.3,
            )
        except Exception:  # noqa: BLE001 - AI must never break the endpoint
            logger.exception("Daily brief narrative generation failed.")
            return None

    # ------------------------------------------------------------- aggregates
    async def get_daily_brief(self, *, use_ai: bool = True) -> DailyBrief:
        snapshot = await self.collect()
        priorities = await self.get_priorities(snapshot=snapshot, use_ai=use_ai)
        stats = self.build_stats(snapshot, priorities)

        engine = self.build_engine()
        context = self.build_context(snapshot)
        important_emails = self._take_important(
            [
                (engine.score_email(message, context), message)
                for message in snapshot.emails
                if not message.is_draft
            ],
            8,
        )
        important_conversations = self._take_important(
            [
                (engine.score_conversation(conversation, context), conversation)
                for conversation in snapshot.conversations
            ],
            6,
        )

        narrative = await self._narrative(snapshot, stats, priorities) if use_ai else None
        agenda = snapshot.agenda

        return DailyBrief(
            timezone=self.timezone,
            date=agenda.date if agenda else utcnow().date().isoformat(),
            profile=snapshot.profile,
            greeting=self._greeting(),
            headline=self._headline(stats),
            meetings=snapshot.meetings,
            conflicts=agenda.conflicts if agenda else [],
            pending_tasks=snapshot.tasks[:20],
            task_summary=snapshot.task_summary,
            important_emails=important_emails,
            important_conversations=important_conversations,
            priorities=priorities.items,
            stats=stats,
            narrative=narrative,
            ai_generated=bool(narrative),
            warnings=snapshot.warnings,
        )

    async def get_user_summary(self, *, use_ai: bool = True) -> UserSummary:
        snapshot = await self.collect()
        priorities = await self.get_priorities(snapshot=snapshot, use_ai=use_ai, limit=10)
        stats = self.build_stats(snapshot, priorities)
        narrative = await self._narrative(snapshot, stats, priorities) if use_ai else None

        return UserSummary(
            timezone=self.timezone,
            profile=snapshot.profile,
            greeting=self._greeting(),
            headline=self._headline(stats),
            highlights=self._highlights(snapshot, priorities),
            recommended_focus=priorities.items[:5],
            stats=stats,
            narrative=narrative,
            ai_generated=bool(narrative),
            warnings=snapshot.warnings,
        )
