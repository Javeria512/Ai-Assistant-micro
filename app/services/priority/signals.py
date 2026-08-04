"""Signal extraction for the unified priority engine.

Each function returns ``(value, note)`` where ``value`` is normalised to 0-1 and
``note`` is the human-readable justification that ends up in ``reasons``.
Keeping them pure makes the scoring deterministic and unit-testable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Sequence, Set, Tuple

from app.schemas.calendar import CalendarEvent
from app.schemas.chat import Conversation
from app.schemas.mail import EmailMessage
from app.schemas.task import TaskItem
from app.utils.datetime_utils import ensure_aware, humanize_delta, utcnow
from app.utils.text import email_domain, normalize_email

Signal = Tuple[float, Optional[str]]

# ------------------------------------------------------------------- lexicon
CRITICAL_TERMS = (
    "urgent",
    "asap",
    "immediately",
    "critical",
    "emergency",
    "outage",
    "sev1",
    "sev 1",
    "p1",
    "escalation",
    "escalated",
    "blocker",
    "production down",
    "showstopper",
)

HIGH_TERMS = (
    "deadline",
    "action required",
    "action needed",
    "needs approval",
    "approval needed",
    "please approve",
    "sign off",
    "signoff",
    "time sensitive",
    "time-sensitive",
    "eod",
    "end of day",
    "by today",
    "by tomorrow",
    "overdue",
    "final reminder",
    "last chance",
    "client waiting",
    "customer waiting",
    "needs your",
    "waiting on you",
    "blocked on",
)

MEDIUM_TERMS = (
    "reminder",
    "follow up",
    "following up",
    "please review",
    "please confirm",
    "awaiting",
    "pending",
    "feedback",
    "asap?",
    "any update",
    "status update",
    "gentle nudge",
)


@dataclass
class PriorityContext:
    """Everything the scorers need that is not on the item itself."""

    now: datetime = field(default_factory=utcnow)
    timezone: str = "UTC"
    user_addresses: Set[str] = field(default_factory=set)
    user_object_id: Optional[str] = None
    vip_contacts: Set[str] = field(default_factory=set)
    frequent_contacts: Set[str] = field(default_factory=set)
    replied_thread_keys: Set[str] = field(default_factory=set)

    @property
    def user_domains(self) -> Set[str]:
        return {email_domain(address) for address in self.user_addresses if address}

    def is_vip(self, address: Optional[str]) -> bool:
        normalized = normalize_email(address)
        if not normalized:
            return False
        if normalized in self.vip_contacts:
            return True
        return email_domain(normalized) in self.vip_contacts

    def is_internal(self, address: Optional[str]) -> bool:
        domain = email_domain(address)
        return bool(domain) and domain in self.user_domains


# ------------------------------------------------------------------ helpers
def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def urgency_language(*texts: Optional[str]) -> Signal:
    """Score urgency wording across subject/preview/title."""
    haystack = " ".join(text.lower() for text in texts if text)
    if not haystack:
        return 0.0, None

    matched = []
    base = 0.0
    for term in CRITICAL_TERMS:
        if term in haystack:
            base = max(base, 1.0)
            matched.append(term)
    for term in HIGH_TERMS:
        if term in haystack:
            base = max(base, 0.65)
            matched.append(term)
    for term in MEDIUM_TERMS:
        if term in haystack:
            base = max(base, 0.35)
            matched.append(term)

    if not matched:
        return 0.0, None
    value = _clamp(base + 0.1 * (len(matched) - 1))
    return value, f'Wording signals urgency ("{matched[0]}")'


def recency_pressure(age_hours: Optional[float]) -> Signal:
    """Newer activity is more likely to still need a response."""
    if age_hours is None:
        return 0.3, None
    if age_hours < 1:
        return 1.0, "Arrived in the last hour"
    if age_hours < 4:
        return 0.85, "Arrived a few hours ago"
    if age_hours < 12:
        return 0.65, None
    if age_hours < 24:
        return 0.5, None
    if age_hours < 72:
        return 0.35, None
    if age_hours < 168:
        return 0.2, None
    return 0.1, None


def staleness(age_hours: Optional[float], unresolved: bool) -> Signal:
    """Something unanswered for days quietly climbs the list."""
    if not unresolved or age_hours is None or age_hours < 24:
        return 0.0, None
    value = _clamp(age_hours / 72.0)
    days = int(age_hours // 24)
    return value, f"Unanswered for {days} day{'s' if days != 1 else ''}"


def sender_authority(context: PriorityContext, address: Optional[str], label: str) -> Signal:
    if not address:
        return 0.25, None
    if context.is_vip(address):
        return 1.0, f"{label} is on your VIP list"
    value = 0.55 if context.is_internal(address) else 0.3
    note = None
    if normalize_email(address) in context.frequent_contacts:
        value = _clamp(value + 0.25)
        note = f"You correspond with this {label.lower()} often"
    return value, note


def importance_signal(importance: str, *, flagged: bool = False) -> Signal:
    value = {"high": 1.0, "normal": 0.35, "low": 0.05}.get((importance or "normal").lower(), 0.35)
    note = "Marked high importance" if value >= 1.0 else None
    if flagged:
        value = max(value, 0.8)
        note = note or "You flagged this for follow-up"
    return value, note


def engagement_scope(participant_count: int, *, personal_is_better: bool = True) -> Signal:
    """Small audiences usually mean the item is genuinely yours to handle."""
    if participant_count <= 1:
        return (1.0 if personal_is_better else 0.3), None
    if participant_count <= 3:
        return 0.8, None
    if participant_count <= 10:
        return 0.5, None
    if participant_count <= 25:
        return 0.3, None
    return 0.15, None


# --------------------------------------------------------------------- email
def email_signals(message: EmailMessage, context: PriorityContext) -> dict:
    sender_address = message.sender.address if message.sender else None
    thread_key = f"subject::{message.clean_subject.lower()}" if message.clean_subject else ""
    already_replied = bool(
        (message.conversation_id and message.conversation_id in context.replied_thread_keys)
        or (thread_key and thread_key in context.replied_thread_keys)
    )

    if not message.is_read and not already_replied:
        unresolved: Signal = (1.0, "Unread and still waiting for you")
    elif message.is_flagged:
        unresolved = (0.85, "Flagged for follow-up")
    elif already_replied:
        unresolved = (0.1, None)
    else:
        unresolved = (0.2, None)

    if message.addressed_directly:
        targeting: Signal = (1.0, "Sent directly to you")
    elif message.is_cc_only:
        targeting = (0.35, "You are only copied")
    else:
        targeting = (0.15, None)

    return {
        "time_pressure": recency_pressure(message.age_hours),
        "explicit_importance": importance_signal(
            message.importance, flagged=message.is_flagged
        ),
        "direct_targeting": targeting,
        "sender_authority": sender_authority(context, sender_address, "Sender"),
        "unresolved": unresolved,
        "urgency_language": urgency_language(message.subject, message.preview),
        "engagement_scope": engagement_scope(message.recipient_count),
        "staleness": staleness(message.age_hours, unresolved[0] >= 0.8),
    }


# ------------------------------------------------------------------- meeting
def meeting_time_pressure(event: CalendarEvent, context: PriorityContext) -> Signal:
    start = ensure_aware(event.start)
    end = ensure_aware(event.end)
    if start is None:
        return 0.3, None

    if end is not None and start <= context.now < end:
        return 1.0, "Happening right now"

    minutes = (start - context.now).total_seconds() / 60.0
    if minutes < 0:
        return 0.05, None
    if minutes <= 15:
        return 1.0, f"Starts {humanize_delta(start, context.now)}"
    if minutes <= 60:
        return 0.9, f"Starts {humanize_delta(start, context.now)}"
    if minutes <= 180:
        return 0.7, f"Starts {humanize_delta(start, context.now)}"
    if minutes <= 480:
        return 0.5, "Later today"
    if minutes <= 1440:
        return 0.3, None
    return 0.15, None


def meeting_signals(event: CalendarEvent, context: PriorityContext) -> dict:
    organizer_address = event.organizer.address if event.organizer else None

    if event.is_organizer:
        targeting: Signal = (1.0, "You are the organizer")
    elif event.user_is_required:
        targeting = (0.8, "You are a required attendee")
    else:
        targeting = (0.4, "You are optional")

    unresolved: Signal = (
        (1.0, "You have not responded to the invite")
        if event.needs_response
        else (0.2, None)
    )

    return {
        "time_pressure": meeting_time_pressure(event, context),
        "explicit_importance": importance_signal(event.importance),
        "direct_targeting": targeting,
        "sender_authority": sender_authority(context, organizer_address, "Organizer"),
        "unresolved": unresolved,
        "urgency_language": urgency_language(event.subject, event.preview),
        "engagement_scope": engagement_scope(event.attendee_count),
        "conflict": (
            (1.0, f"Overlaps {', '.join(event.conflicts_with[:2])}")
            if event.has_conflict
            else (0.0, None)
        ),
    }


# ---------------------------------------------------------------------- task
def task_time_pressure(task: TaskItem, context: PriorityContext) -> Signal:
    due = ensure_aware(task.due_at)
    if due is None:
        return 0.25, None

    if task.is_overdue:
        return 1.0, f"Overdue ({humanize_delta(due, context.now)})"

    hours = (due - context.now).total_seconds() / 3600.0
    if hours <= 4:
        return 0.95, f"Due {humanize_delta(due, context.now)}"
    if hours <= 24:
        return 0.85, "Due today"
    if hours <= 48:
        return 0.65, "Due tomorrow"
    if hours <= 72:
        return 0.5, None
    if hours <= 168:
        return 0.35, None
    return 0.2, None


def task_signals(task: TaskItem, context: PriorityContext) -> dict:
    if task.status == "notStarted":
        unresolved: Signal = (1.0, "Not started yet")
    elif task.status == "inProgress":
        unresolved = (0.6, "In progress")
    else:
        unresolved = (0.3, None)

    assigned_by_other = bool(task.created_by and task.created_by != context.user_object_id)
    targeting: Signal = (
        (0.8, "Assigned to you by someone else") if assigned_by_other else (0.4, None)
    )

    age_hours = None
    created = ensure_aware(task.created_at)
    if created is not None:
        age_hours = (context.now - created).total_seconds() / 3600.0

    return {
        "time_pressure": task_time_pressure(task, context),
        "explicit_importance": importance_signal(task.importance),
        "direct_targeting": targeting,
        "unresolved": unresolved,
        "urgency_language": urgency_language(task.title, task.notes),
        "staleness": staleness(age_hours, task.status == "notStarted" and task.has_due_date),
    }


# ---------------------------------------------------------------------- chat
def conversation_signals(conversation: Conversation, context: PriorityContext) -> dict:
    sender_address = (
        conversation.last_message_from.email if conversation.last_message_from else None
    )

    if conversation.mentions_me:
        targeting: Signal = (1.0, "You were @mentioned")
    elif conversation.chat_type == "oneOnOne":
        targeting = (0.85, "Direct message")
    elif conversation.chat_type == "meeting":
        targeting = (0.4, None)
    else:
        targeting = (0.3, None)

    if conversation.waiting_on_me:
        unresolved: Signal = (1.0, "Waiting on your reply")
    elif conversation.is_unread:
        unresolved = (0.8, "Unread messages")
    else:
        unresolved = (0.1, None)

    return {
        "time_pressure": recency_pressure(conversation.age_hours),
        "explicit_importance": importance_signal("normal"),
        "direct_targeting": targeting,
        "sender_authority": sender_authority(context, sender_address, "Sender"),
        "unresolved": unresolved,
        "urgency_language": urgency_language(
            conversation.topic, conversation.last_message_preview
        ),
        "engagement_scope": engagement_scope(max(conversation.participant_count - 1, 1)),
        "staleness": staleness(conversation.age_hours, conversation.waiting_on_me),
    }


def build_frequent_contacts(
    messages: Sequence[EmailMessage], *, threshold: int = 3
) -> Set[str]:
    """Addresses seen often enough in the recent window to matter."""
    counts: dict = {}
    for message in messages:
        address = message.sender.address if message.sender else None
        if not address or message.looks_automated:
            continue
        counts[address] = counts.get(address, 0) + 1
    return {address for address, count in counts.items() if count >= threshold}
