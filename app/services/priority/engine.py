"""The Single Unified Priority engine.

Emails, meetings, tasks and Teams conversations are all reduced to the same
``PriorityItem`` shape and scored with one weighted-signal model, so a single
ranked list can answer "what should I do next?" across every system.

Pipeline:

    raw items -> signal extraction -> weighted average -> hard rules
              -> bucketing -> (optional) LLM rerank -> ranked list

The deterministic pass always runs. An LLM reranker is optional and additive:
if none is configured the output is identical, which keeps the endpoint fast
and predictable while leaving the AI seam in place.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Mapping, Optional, Protocol, Sequence, Tuple

from app.core.config import get_settings
from app.schemas.calendar import CalendarEvent
from app.schemas.chat import Conversation
from app.schemas.common import Person, PriorityBucket, SourceType
from app.schemas.mail import EmailMessage
from app.schemas.priority import (
    BucketCounts,
    PriorityItem,
    PriorityList,
    SignalScore,
    SourceCounts,
)
from app.schemas.task import TaskItem
from app.services.priority import weights as W
from app.services.priority.signals import (
    PriorityContext,
    conversation_signals,
    email_signals,
    meeting_signals,
    task_signals,
)
from app.utils.datetime_utils import ensure_aware, utcnow
from app.utils.text import snippet

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_REASONS = 3


class PriorityReranker(Protocol):
    """Optional AI stage that can reorder or re-explain the ranked list."""

    name: str

    async def rerank(
        self, items: List[PriorityItem], context: PriorityContext
    ) -> List[PriorityItem]:
        ...


class PriorityEngine:
    """Deterministic, explainable scoring across all activity sources."""

    strategy = "rules-v1"

    def __init__(
        self,
        *,
        weight_overrides: Optional[Mapping[str, Mapping[str, float]]] = None,
        reranker: Optional[PriorityReranker] = None,
    ) -> None:
        self.weights = W.resolve_weights(weight_overrides)
        self.reranker = reranker

    # ------------------------------------------------------------- internals
    def _score(
        self, source: SourceType, raw_signals: Dict[str, Tuple[float, Optional[str]]]
    ) -> Tuple[float, List[SignalScore], List[str]]:
        """Weighted average of the signals, plus explanations."""
        source_weights = self.weights.get(source.value, {})
        scores: List[SignalScore] = []
        total_weight = 0.0
        total_contribution = 0.0

        for name, (value, note) in raw_signals.items():
            weight = float(source_weights.get(name, 0.0))
            if weight <= 0.0:
                continue
            value = max(0.0, min(1.0, float(value)))
            contribution = value * weight
            total_weight += weight
            total_contribution += contribution
            scores.append(
                SignalScore(
                    name=name,
                    value=round(value, 4),
                    weight=weight,
                    contribution=round(contribution, 4),
                    note=note,
                )
            )

        score = (total_contribution / total_weight * 100.0) if total_weight else 0.0
        scores.sort(key=lambda item: item.contribution, reverse=True)

        reasons: List[str] = []
        for signal in scores:
            if signal.note and signal.note not in reasons:
                reasons.append(signal.note)
            if len(reasons) >= MAX_REASONS:
                break
        if not reasons and scores:
            reasons.append(W.signal_label(scores[0].name))

        return round(score, 2), scores, reasons

    @staticmethod
    def _bucket(score: float) -> PriorityBucket:
        if score >= W.BUCKET_THRESHOLDS["critical"]:
            return PriorityBucket.CRITICAL
        if score >= W.BUCKET_THRESHOLDS["high"]:
            return PriorityBucket.HIGH
        if score >= W.BUCKET_THRESHOLDS["medium"]:
            return PriorityBucket.MEDIUM
        return PriorityBucket.LOW

    # ---------------------------------------------------------------- emails
    def score_email(self, message: EmailMessage, context: PriorityContext) -> PriorityItem:
        raw = email_signals(message, context)
        score, signals, reasons = self._score(SourceType.EMAIL, raw)

        if message.looks_automated:
            score = round(score * W.AUTOMATED_EMAIL_MULTIPLIER, 2)
            reasons.append("Looks like an automated notification")
        elif (
            not message.is_read
            and message.addressed_directly
            and message.sender
            and context.is_vip(message.sender.address)
        ):
            score = max(score, W.FLOOR_VIP_DIRECT)

        sender = message.sender
        return PriorityItem(
            id=f"{SourceType.EMAIL.value}:{message.id}",
            source=SourceType.EMAIL,
            source_id=message.id,
            title=message.subject,
            subtitle=f"From {sender.name or sender.address}" if sender else None,
            snippet=snippet(message.preview, 200),
            actors=[sender] if sender else [],
            occurred_at=message.received_at,
            due_at=None,
            score=min(score, 100.0),
            bucket=self._bucket(score),
            reasons=reasons[:MAX_REASONS],
            signals=signals,
            action_hint="Reply" if not message.is_read else "Review",
            deep_link=message.web_link,
            metadata={
                "conversation_id": message.conversation_id,
                "is_read": message.is_read,
                "has_attachments": message.has_attachments,
                "importance": message.importance,
            },
        )

    # -------------------------------------------------------------- meetings
    def score_meeting(self, event: CalendarEvent, context: PriorityContext) -> PriorityItem:
        raw = meeting_signals(event, context)
        score, signals, reasons = self._score(SourceType.MEETING, raw)

        start = ensure_aware(event.start)
        end = ensure_aware(event.end)
        if start and end and start <= context.now < end:
            score = max(score, W.FLOOR_MEETING_IN_PROGRESS)
        elif start and 0 <= (start - context.now).total_seconds() <= 900:
            score = max(score, W.FLOOR_MEETING_IMMINENT)

        if event.join_url and start and (start - context.now).total_seconds() <= 900:
            action = "Join"
        elif event.needs_response:
            action = "Respond"
        else:
            action = "Prepare"

        organizer = event.organizer
        return PriorityItem(
            id=f"{SourceType.MEETING.value}:{event.id}",
            source=SourceType.MEETING,
            source_id=event.id,
            title=event.subject,
            subtitle=(
                f"Organized by {organizer.name or organizer.address}" if organizer else None
            ),
            snippet=snippet(event.preview, 200),
            actors=[organizer] if organizer else [],
            occurred_at=event.start,
            due_at=event.start,
            score=min(score, 100.0),
            bucket=self._bucket(score),
            reasons=reasons[:MAX_REASONS],
            signals=signals,
            action_hint=action,
            deep_link=event.join_url or event.web_link,
            metadata={
                "start": event.start.isoformat() if event.start else None,
                "end": event.end.isoformat() if event.end else None,
                "duration_minutes": event.duration_minutes,
                "attendee_count": event.attendee_count,
                "is_online_meeting": event.is_online_meeting,
                "has_conflict": event.has_conflict,
            },
        )

    # ----------------------------------------------------------------- tasks
    def score_task(self, task: TaskItem, context: PriorityContext) -> PriorityItem:
        raw = task_signals(task, context)
        score, signals, reasons = self._score(SourceType.TASK, raw)

        if task.is_overdue:
            score = max(score, W.FLOOR_OVERDUE_TASK)

        return PriorityItem(
            id=f"{SourceType.TASK.value}:{task.source.value}:{task.id}",
            source=SourceType.TASK,
            source_id=task.id,
            title=task.title,
            subtitle=task.list_name,
            snippet=snippet(task.notes, 200),
            actors=[],
            occurred_at=task.created_at,
            due_at=task.due_at,
            score=min(score, 100.0),
            bucket=self._bucket(score),
            reasons=reasons[:MAX_REASONS],
            signals=signals,
            action_hint="Complete" if task.status == "inProgress" else "Start",
            deep_link=task.web_link,
            metadata={
                "task_source": task.source.value,
                "status": task.status,
                "is_overdue": task.is_overdue,
                "percent_complete": task.percent_complete,
                "plan_id": task.plan_id,
                "list_id": task.list_id,
            },
        )

    # ----------------------------------------------------------------- chats
    def score_conversation(
        self, conversation: Conversation, context: PriorityContext
    ) -> PriorityItem:
        raw = conversation_signals(conversation, context)
        score, signals, reasons = self._score(SourceType.CHAT, raw)

        sender = conversation.last_message_from
        actor = (
            Person(name=sender.name, address=sender.email) if sender is not None else None
        )

        return PriorityItem(
            id=f"{SourceType.CHAT.value}:{conversation.id}",
            source=SourceType.CHAT,
            source_id=conversation.id,
            title=conversation.display_name or conversation.topic or "Teams chat",
            subtitle=(
                f"Last message from {sender.name or sender.email}" if sender else None
            ),
            snippet=snippet(conversation.last_message_preview, 200),
            actors=[actor] if actor else [],
            occurred_at=conversation.last_activity_at,
            due_at=None,
            score=min(score, 100.0),
            bucket=self._bucket(score),
            reasons=reasons[:MAX_REASONS],
            signals=signals,
            action_hint="Reply",
            deep_link=conversation.web_url,
            metadata={
                "chat_type": conversation.chat_type,
                "participant_count": conversation.participant_count,
                "mentions_me": conversation.mentions_me,
                "is_unread": conversation.is_unread,
            },
        )

    # ------------------------------------------------------------ aggregation
    def score_all(
        self,
        context: PriorityContext,
        *,
        emails: Optional[Sequence[EmailMessage]] = None,
        meetings: Optional[Sequence[CalendarEvent]] = None,
        tasks: Optional[Sequence[TaskItem]] = None,
        conversations: Optional[Sequence[Conversation]] = None,
    ) -> List[PriorityItem]:
        """Score every supplied activity into one unranked list."""
        items: List[PriorityItem] = []

        for message in emails or []:
            if message.is_draft:
                continue
            items.append(self.score_email(message, context))

        for event in meetings or []:
            if event.is_cancelled:
                continue
            end = ensure_aware(event.end)
            if end is not None and end < context.now:
                continue  # already finished; nothing to act on
            items.append(self.score_meeting(event, context))

        for task in tasks or []:
            if task.is_completed:
                continue
            items.append(self.score_task(task, context))

        for conversation in conversations or []:
            items.append(self.score_conversation(conversation, context))

        return items

    @staticmethod
    def rank(items: List[PriorityItem], *, limit: Optional[int] = None) -> List[PriorityItem]:
        """Sort by score, break ties with the nearest deadline, then assign ranks."""

        def sort_key(item: PriorityItem):
            due = ensure_aware(item.due_at)
            return (
                -item.score,
                due.timestamp() if due else float("inf"),
                item.title.lower(),
            )

        ordered = sorted(items, key=sort_key)
        if limit:
            ordered = ordered[:limit]
        for index, item in enumerate(ordered, start=1):
            item.rank = index
        return ordered

    async def build(
        self,
        context: PriorityContext,
        *,
        emails: Optional[Sequence[EmailMessage]] = None,
        meetings: Optional[Sequence[CalendarEvent]] = None,
        tasks: Optional[Sequence[TaskItem]] = None,
        conversations: Optional[Sequence[Conversation]] = None,
        limit: Optional[int] = None,
        warnings: Optional[List[str]] = None,
    ) -> PriorityList:
        """Full pipeline: score, optionally rerank, rank and summarise."""
        scored = self.score_all(
            context,
            emails=emails,
            meetings=meetings,
            tasks=tasks,
            conversations=conversations,
        )
        total_considered = len(scored)
        strategy = self.strategy

        if self.reranker is not None and scored:
            try:
                scored = await self.reranker.rerank(scored, context)
                strategy = self.reranker.name
            except Exception:  # noqa: BLE001 - AI must never break the endpoint
                logger.exception("Priority reranker failed; using deterministic order.")

        ranked = self.rank(scored, limit=limit or settings.PRIORITY_MAX_ITEMS)

        buckets = BucketCounts()
        sources = SourceCounts()
        for item in ranked:
            setattr(buckets, item.bucket.value, getattr(buckets, item.bucket.value) + 1)
            setattr(sources, item.source.value, getattr(sources, item.source.value) + 1)

        return PriorityList(
            generated_at=utcnow(),
            timezone=context.timezone,
            items=ranked,
            total_considered=total_considered,
            buckets=buckets,
            sources=sources,
            strategy=strategy,
            warnings=warnings or [],
        )
