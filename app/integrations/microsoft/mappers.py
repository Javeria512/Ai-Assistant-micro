"""Translate raw Microsoft Graph payloads into application schemas.

Keeping every ``payload.get("someOdataField")`` in one module means the rest of
the codebase never sees Graph's naming, and a Graph shape change is a one-file
fix.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set

from app.schemas.calendar import Attendee, CalendarEvent
from app.schemas.chat import ChatMessage, ChatParticipant, Conversation
from app.schemas.common import Person
from app.schemas.mail import EmailMessage
from app.schemas.task import TaskItem, TaskList, TaskSource
from app.schemas.user import MailboxPreferences, UserProfile, WorkingHours
from app.utils.datetime_utils import (
    ensure_aware,
    hours_since,
    minutes_between,
    parse_graph_date_time_zone,
    parse_graph_datetime,
    utcnow,
)
from app.utils.text import (
    clean_subject,
    initials,
    normalize_email,
    snippet,
    strip_html,
)

AUTOMATED_SENDER_PREFIXES = (
    "noreply",
    "no-reply",
    "no_reply",
    "donotreply",
    "do-not-reply",
    "notification",
    "notifications",
    "mailer",
    "newsletter",
    "alerts",
    "alert",
    "bounce",
    "postmaster",
    "info@",
    "support@",
    "marketing",
)

AUTOMATED_BODY_MARKERS = (
    "unsubscribe",
    "view this email in your browser",
    "manage your preferences",
    "this is an automated message",
    "do not reply to this email",
)

# Planner encodes priority as 0-10; 1 = urgent, 3 = important, 5 = medium, 9 = low.
_PLANNER_PRIORITY_BANDS = ((0, 2, "high"), (3, 4, "high"), (5, 7, "normal"), (8, 10, "low"))


@dataclass
class GraphIdentity:
    """Who "me" is, used to derive `is this addressed to me?` signals."""

    object_id: Optional[str] = None
    addresses: Set[str] = field(default_factory=set)
    display_name: Optional[str] = None

    @classmethod
    def build(
        cls,
        *,
        object_id: Optional[str] = None,
        display_name: Optional[str] = None,
        addresses: Optional[Iterable[Optional[str]]] = None,
    ) -> "GraphIdentity":
        normalized = {normalize_email(item) for item in (addresses or []) if item}
        return cls(
            object_id=object_id,
            addresses={item for item in normalized if item},
            display_name=display_name,
        )

    def is_me(self, address: Optional[str] = None, user_id: Optional[str] = None) -> bool:
        if user_id and self.object_id and user_id == self.object_id:
            return True
        if address and normalize_email(address) in self.addresses:
            return True
        return False


# --------------------------------------------------------------------- utils
def _email_address(node: Optional[Dict[str, Any]]) -> Optional[Person]:
    """Unwrap Graph's ``{"emailAddress": {"name": ..., "address": ...}}``."""
    if not node:
        return None
    inner = node.get("emailAddress") if "emailAddress" in node else node
    if not isinstance(inner, dict):
        return None
    name = inner.get("name")
    address = inner.get("address")
    if not name and not address:
        return None
    return Person(name=name, address=normalize_email(address) or None)


def _people(nodes: Optional[List[Dict[str, Any]]]) -> List[Person]:
    people = []
    for node in nodes or []:
        person = _email_address(node)
        if person:
            people.append(person)
    return people


def _body_text(node: Optional[Dict[str, Any]]) -> str:
    if not node:
        return ""
    content = node.get("content") or ""
    if (node.get("contentType") or "").lower() == "html":
        return strip_html(content)
    return content.strip()


def _looks_automated(sender: Optional[Person], preview: str) -> bool:
    address = (sender.address if sender else "") or ""
    if any(address.startswith(prefix) for prefix in AUTOMATED_SENDER_PREFIXES):
        return True
    lowered = preview.lower()
    return any(marker in lowered for marker in AUTOMATED_BODY_MARKERS)


# ---------------------------------------------------------------- user/profile
def map_user_profile(
    payload: Dict[str, Any],
    *,
    user_id: str,
    timezone: str = "UTC",
    last_login_at: Optional[datetime] = None,
) -> UserProfile:
    display_name = payload.get("displayName")
    return UserProfile(
        id=user_id,
        ms_object_id=payload.get("id"),
        display_name=display_name,
        given_name=payload.get("givenName"),
        surname=payload.get("surname"),
        email=normalize_email(payload.get("mail") or payload.get("userPrincipalName")) or None,
        user_principal_name=payload.get("userPrincipalName"),
        job_title=payload.get("jobTitle"),
        department=payload.get("department"),
        office_location=payload.get("officeLocation"),
        mobile_phone=payload.get("mobilePhone"),
        business_phones=payload.get("businessPhones") or [],
        preferred_language=payload.get("preferredLanguage"),
        timezone=timezone,
        initials=initials(display_name),
        last_login_at=last_login_at,
    )


def map_mailbox_settings(payload: Dict[str, Any]) -> MailboxPreferences:
    working = payload.get("workingHours") or {}
    automatic_replies = payload.get("automaticRepliesSetting") or {}
    return MailboxPreferences(
        timezone=payload.get("timeZone"),
        date_format=payload.get("dateFormat"),
        time_format=payload.get("timeFormat"),
        language=(payload.get("language") or {}).get("locale"),
        automatic_replies_status=automatic_replies.get("status"),
        working_hours=WorkingHours(
            days_of_week=working.get("daysOfWeek") or [],
            start_time=working.get("startTime"),
            end_time=working.get("endTime"),
            timezone=(working.get("timeZone") or {}).get("name"),
        )
        if working
        else None,
    )


# ------------------------------------------------------------------------ mail
def map_email(
    payload: Dict[str, Any],
    *,
    identity: GraphIdentity,
    now: Optional[datetime] = None,
    include_body: bool = False,
) -> EmailMessage:
    now = now or utcnow()
    sender = _email_address(payload.get("from") or payload.get("sender"))
    to_recipients = _people(payload.get("toRecipients"))
    cc_recipients = _people(payload.get("ccRecipients"))
    preview = snippet(payload.get("bodyPreview"), 300)

    to_addresses = {person.address for person in to_recipients if person.address}
    cc_addresses = {person.address for person in cc_recipients if person.address}
    addressed_directly = bool(identity.addresses & to_addresses)
    is_cc_only = bool(identity.addresses & cc_addresses) and not addressed_directly

    flag = payload.get("flag") or {}
    flag_status = flag.get("flagStatus")
    received_at = parse_graph_datetime(payload.get("receivedDateTime"))
    subject = payload.get("subject") or "(no subject)"

    return EmailMessage(
        id=payload.get("id", ""),
        conversation_id=payload.get("conversationId"),
        subject=subject,
        clean_subject=clean_subject(subject),
        preview=preview,
        body=_body_text(payload.get("body")) if include_body else None,
        sender=sender,
        to_recipients=to_recipients,
        cc_recipients=cc_recipients,
        received_at=received_at,
        sent_at=parse_graph_datetime(payload.get("sentDateTime")),
        is_read=bool(payload.get("isRead")),
        is_draft=bool(payload.get("isDraft")),
        has_attachments=bool(payload.get("hasAttachments")),
        importance=(payload.get("importance") or "normal").lower(),
        flag_status=flag_status,
        categories=payload.get("categories") or [],
        inference_classification=payload.get("inferenceClassification"),
        web_link=payload.get("webLink"),
        recipient_count=len(to_recipients) + len(cc_recipients),
        addressed_directly=addressed_directly,
        is_cc_only=is_cc_only,
        is_flagged=flag_status == "flagged",
        looks_automated=_looks_automated(sender, preview),
        age_hours=hours_since(received_at, now),
    )


# -------------------------------------------------------------------- calendar
def map_event(
    payload: Dict[str, Any],
    *,
    identity: GraphIdentity,
    now: Optional[datetime] = None,
) -> CalendarEvent:
    now = now or utcnow()
    start = parse_graph_date_time_zone(payload.get("start"))
    end = parse_graph_date_time_zone(payload.get("end"))

    attendees: List[Attendee] = []
    required_count = 0
    user_is_required = bool(payload.get("isOrganizer"))
    for node in payload.get("attendees") or []:
        person = _email_address(node)
        attendee_type = node.get("type")
        status = (node.get("status") or {}).get("response")
        attendees.append(
            Attendee(
                name=person.name if person else None,
                address=person.address if person else None,
                type=attendee_type,
                response=status,
            )
        )
        if attendee_type == "required":
            required_count += 1
            if person and identity.is_me(person.address):
                user_is_required = True

    online = payload.get("onlineMeeting") or {}
    response_status = (payload.get("responseStatus") or {}).get("response")
    location = (payload.get("location") or {}).get("displayName")

    return CalendarEvent(
        id=payload.get("id", ""),
        subject=payload.get("subject") or "(no subject)",
        preview=snippet(payload.get("bodyPreview"), 240),
        start=start,
        end=end,
        is_all_day=bool(payload.get("isAllDay")),
        duration_minutes=minutes_between(start, end),
        starts_in_minutes=minutes_between(now, start),
        organizer=_email_address(payload.get("organizer")),
        is_organizer=bool(payload.get("isOrganizer")),
        location=location,
        is_online_meeting=bool(payload.get("isOnlineMeeting")),
        join_url=online.get("joinUrl") or payload.get("onlineMeetingUrl"),
        online_meeting_provider=payload.get("onlineMeetingProvider"),
        attendees=attendees,
        attendee_count=len(attendees),
        required_attendee_count=required_count,
        user_is_required=user_is_required,
        response_status=response_status,
        needs_response=response_status in {"none", "notResponded"},
        importance=(payload.get("importance") or "normal").lower(),
        sensitivity=payload.get("sensitivity"),
        show_as=payload.get("showAs"),
        is_cancelled=bool(payload.get("isCancelled")),
        is_recurring=bool(payload.get("seriesMasterId")) or payload.get("type") == "occurrence",
        categories=payload.get("categories") or [],
        web_link=payload.get("webLink"),
    )


# ----------------------------------------------------------------------- tasks
def map_todo_list(payload: Dict[str, Any]) -> TaskList:
    return TaskList(
        id=payload.get("id", ""),
        name=payload.get("displayName") or "Tasks",
        source=TaskSource.TODO,
        is_default=payload.get("wellknownListName") == "defaultList",
        is_shared=bool(payload.get("isShared")),
    )


def map_todo_task(
    payload: Dict[str, Any],
    *,
    list_id: Optional[str] = None,
    list_name: Optional[str] = None,
    now: Optional[datetime] = None,
) -> TaskItem:
    now = now or utcnow()
    due_at = parse_graph_date_time_zone(payload.get("dueDateTime"))
    status = payload.get("status") or "notStarted"
    is_completed = status == "completed"

    days_until_due = None
    if due_at is not None:
        days_until_due = (due_at - now).total_seconds() / 86400.0

    return TaskItem(
        id=payload.get("id", ""),
        source=TaskSource.TODO,
        title=payload.get("title") or "(untitled task)",
        notes=snippet(_body_text(payload.get("body")), 300),
        list_id=list_id,
        list_name=list_name,
        status=status,
        importance=(payload.get("importance") or "normal").lower(),
        percent_complete=100 if is_completed else (50 if status == "inProgress" else 0),
        is_completed=is_completed,
        created_at=parse_graph_datetime(payload.get("createdDateTime")),
        due_at=due_at,
        reminder_at=parse_graph_date_time_zone(payload.get("reminderDateTime")),
        completed_at=parse_graph_date_time_zone(payload.get("completedDateTime")),
        is_overdue=bool(due_at and not is_completed and due_at < now),
        days_until_due=days_until_due,
        has_due_date=due_at is not None,
        categories=payload.get("categories") or [],
    )


def _planner_importance(priority: Optional[int]) -> str:
    if priority is None:
        return "normal"
    for low, high, label in _PLANNER_PRIORITY_BANDS:
        if low <= priority <= high:
            return label
    return "normal"


def map_planner_task(
    payload: Dict[str, Any],
    *,
    plan_names: Optional[Dict[str, str]] = None,
    tenant_id: Optional[str] = None,
    now: Optional[datetime] = None,
) -> TaskItem:
    now = now or utcnow()
    due_at = parse_graph_datetime(payload.get("dueDateTime"))
    percent = int(payload.get("percentComplete") or 0)
    is_completed = percent >= 100
    plan_id = payload.get("planId")

    days_until_due = None
    if due_at is not None:
        days_until_due = (due_at - now).total_seconds() / 86400.0

    task_id = payload.get("id", "")
    web_link = (
        f"https://tasks.office.com/{tenant_id}/Home/Task/{task_id}"
        if tenant_id and task_id
        else None
    )

    return TaskItem(
        id=task_id,
        source=TaskSource.PLANNER,
        title=payload.get("title") or "(untitled task)",
        notes="",
        plan_id=plan_id,
        bucket_id=payload.get("bucketId"),
        list_name=(plan_names or {}).get(plan_id or "", "Planner"),
        status="completed" if is_completed else ("inProgress" if percent > 0 else "notStarted"),
        importance=_planner_importance(payload.get("priority")),
        percent_complete=percent,
        is_completed=is_completed,
        created_at=parse_graph_datetime(payload.get("createdDateTime")),
        due_at=due_at,
        completed_at=parse_graph_datetime(payload.get("completedDateTime")),
        is_overdue=bool(due_at and not is_completed and due_at < now),
        days_until_due=days_until_due,
        has_due_date=due_at is not None,
        web_link=web_link,
        created_by=((payload.get("createdBy") or {}).get("user") or {}).get("id"),
    )


# ----------------------------------------------------------------------- teams
def _chat_participant(node: Optional[Dict[str, Any]]) -> Optional[ChatParticipant]:
    """Handle both ``identitySet`` and ``conversationMember`` shapes."""
    if not node:
        return None
    if "user" in node or "application" in node:
        inner = node.get("user") or node.get("application") or {}
        return ChatParticipant(
            id=inner.get("id"),
            name=inner.get("displayName"),
            email=normalize_email(inner.get("email") or inner.get("userPrincipalName")) or None,
        )
    return ChatParticipant(
        id=node.get("userId") or node.get("id"),
        name=node.get("displayName"),
        email=normalize_email(node.get("email")) or None,
    )


def map_chat_message(
    payload: Dict[str, Any],
    *,
    identity: GraphIdentity,
    chat_id: Optional[str] = None,
) -> ChatMessage:
    author = _chat_participant(payload.get("from"))
    content = _body_text(payload.get("body"))

    mentions_me = False
    for mention in payload.get("mentions") or []:
        mentioned = _chat_participant(mention.get("mentioned"))
        if mentioned and identity.is_me(mentioned.email, mentioned.id):
            mentions_me = True
            break

    return ChatMessage(
        id=payload.get("id", ""),
        chat_id=chat_id,
        created_at=parse_graph_datetime(payload.get("createdDateTime")),
        author=author,
        content=snippet(content, 500),
        importance=(payload.get("importance") or "normal").lower(),
        message_type=payload.get("messageType") or "message",
        from_me=bool(author and identity.is_me(author.email, author.id)),
        mentions_me=mentions_me,
        has_attachments=bool(payload.get("attachments")),
        web_url=payload.get("webUrl"),
    )


def map_conversation(
    payload: Dict[str, Any],
    *,
    identity: GraphIdentity,
    now: Optional[datetime] = None,
) -> Conversation:
    """Map ``/me/chats`` (expanded with ``lastMessagePreview`` and ``members``)."""
    now = now or utcnow()
    preview_node = payload.get("lastMessagePreview") or {}
    viewpoint = payload.get("viewpoint") or {}

    participants = [
        participant
        for participant in (
            _chat_participant(node) for node in (payload.get("members") or [])
        )
        if participant is not None
    ]
    others = [
        participant
        for participant in participants
        if not identity.is_me(participant.email, participant.id)
    ]

    last_sender = _chat_participant(preview_node.get("from"))
    last_from_me = bool(last_sender and identity.is_me(last_sender.email, last_sender.id))
    last_activity = parse_graph_datetime(
        preview_node.get("createdDateTime") or payload.get("lastUpdatedDateTime")
    )
    last_read = parse_graph_datetime(viewpoint.get("lastMessageReadDateTime"))

    is_unread = False
    if last_activity is not None and not last_from_me:
        is_unread = last_read is None or ensure_aware(last_read) < last_activity

    topic = payload.get("topic")
    chat_type = payload.get("chatType") or "oneOnOne"

    # `$expand=members` leaves displayName and email null for participants this
    # app is not allowed to read, and resolving them from /users/{id} needs
    # User.ReadBasic.All, which is not in the consented scope set. Name the chat
    # by its shape in that case — "Direct message" beats a literal "Unknown".
    named = [person.name or person.email for person in others if person.name or person.email]
    if topic:
        display_name = topic
    elif named:
        display_name = ", ".join(named[:3])
        if len(named) > 3:
            display_name += f" +{len(named) - 3}"
    elif others:
        display_name = (
            "Direct message"
            if chat_type == "oneOnOne"
            else f"Group chat ({len(others) + 1} people)"
        )
    else:
        display_name = "Chat"

    return Conversation(
        id=payload.get("id", ""),
        topic=topic,
        chat_type=chat_type,
        web_url=payload.get("webUrl"),
        created_at=parse_graph_datetime(payload.get("createdDateTime")),
        last_activity_at=last_activity,
        last_read_at=last_read,
        last_message_preview=snippet(_body_text(preview_node.get("body")), 240),
        last_message_from=last_sender,
        last_message_from_me=last_from_me,
        participants=participants,
        participant_count=len(participants),
        is_unread=is_unread,
        waiting_on_me=is_unread and not last_from_me,
        age_hours=hours_since(last_activity, now),
        display_name=display_name,
    )
