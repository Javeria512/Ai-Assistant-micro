"""End-to-end aggregation test with a stubbed Microsoft Graph.

Exercises the real code path: services -> mappers -> priority engine ->
daily brief, without touching the network.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple

import pytest

from app.schemas.common import SourceType
from app.services.assistant_service import AssistantService
from app.utils.datetime_utils import utcnow

NOW = utcnow()


def _iso(delta_minutes: float) -> str:
    return (NOW + timedelta(minutes=delta_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _graph_dt(delta_minutes: float) -> Dict[str, str]:
    return {
        "dateTime": (NOW + timedelta(minutes=delta_minutes)).strftime(
            "%Y-%m-%dT%H:%M:%S.0000000"
        ),
        "timeZone": "UTC",
    }


GRAPH_DATA: Dict[str, List[Dict[str, Any]]] = {
    "/me/mailFolders/inbox/messages": [
        {
            "id": "mail-vip",
            "conversationId": "conv-vip",
            "subject": "Budget sign off needed before Friday",
            "bodyPreview": "Please approve the Q3 budget, it is blocking the team.",
            "importance": "high",
            "isRead": False,
            "receivedDateTime": _iso(-45),
            "from": {"emailAddress": {"name": "Chief Exec", "address": "ceo@acme.com"}},
            "toRecipients": [{"emailAddress": {"address": "manager@acme.com"}}],
            "webLink": "https://outlook.office.com/mail/id/mail-vip",
        },
        {
            "id": "mail-newsletter",
            "conversationId": "conv-news",
            "subject": "URGENT: your weekly industry digest",
            "bodyPreview": "Top stories this week. Unsubscribe any time.",
            "importance": "high",
            "isRead": False,
            "receivedDateTime": _iso(-30),
            "from": {"emailAddress": {"name": "Digest", "address": "noreply@news.io"}},
            "toRecipients": [{"emailAddress": {"address": "manager@acme.com"}}],
        },
        {
            "id": "mail-cc",
            "conversationId": "conv-cc",
            "subject": "FYI: office move",
            "bodyPreview": "Sharing for visibility.",
            "importance": "normal",
            "isRead": True,
            "receivedDateTime": _iso(-2000),
            "from": {"emailAddress": {"name": "Facilities", "address": "fac@acme.com"}},
            "toRecipients": [{"emailAddress": {"address": "someone@acme.com"}}],
            "ccRecipients": [{"emailAddress": {"address": "manager@acme.com"}}],
        },
    ],
    "/me/mailFolders/sentitems/messages": [
        {"conversationId": "conv-cc", "subject": "RE: FYI: office move", "sentDateTime": _iso(-100)}
    ],
    "/me/calendarView": [
        {
            "id": "evt-soon",
            "subject": "Incident review",
            "bodyPreview": "Post-mortem for the outage",
            "start": _graph_dt(10),
            "end": _graph_dt(40),
            "isOrganizer": False,
            "organizer": {"emailAddress": {"name": "Sam", "address": "sam@acme.com"}},
            "attendees": [
                {
                    "type": "required",
                    "status": {"response": "none"},
                    "emailAddress": {"address": "manager@acme.com"},
                }
            ],
            "responseStatus": {"response": "none"},
            "isOnlineMeeting": True,
            "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/1"},
        },
        {
            "id": "evt-later",
            "subject": "1:1 with Sam",
            "start": _graph_dt(300),
            "end": _graph_dt(330),
            "isOrganizer": True,
            "organizer": {"emailAddress": {"address": "manager@acme.com"}},
            "attendees": [],
            "responseStatus": {"response": "organizer"},
        },
    ],
    "/me/todo/lists": [{"id": "list-1", "displayName": "Work", "wellknownListName": "defaultList"}],
    "/me/todo/lists/list-1/tasks": [
        {
            "id": "task-overdue",
            "title": "Submit compliance report",
            "status": "notStarted",
            "importance": "normal",
            "createdDateTime": _iso(-6000),
            "dueDateTime": _graph_dt(-2880),
        },
        {
            "id": "task-later",
            "title": "Plan Q4 offsite",
            "status": "notStarted",
            "importance": "low",
            "createdDateTime": _iso(-500),
        },
        {
            "id": "task-done",
            "title": "Already finished",
            "status": "completed",
            "completedDateTime": _graph_dt(-100),
        },
    ],
    "/me/planner/tasks": [],
    "/me/chats": [
        {
            "id": "chat-waiting",
            "chatType": "oneOnOne",
            "lastUpdatedDateTime": _iso(-20),
            "viewpoint": {"lastMessageReadDateTime": _iso(-600)},
            "lastMessagePreview": {
                "id": "cm-1",
                "createdDateTime": _iso(-20),
                "body": {"contentType": "text", "content": "Can you confirm the release window?"},
                "from": {"user": {"id": "oid-2", "displayName": "Sam Peer"}},
            },
            "members": [
                {"userId": "oid-1", "displayName": "Alex", "email": "manager@acme.com"},
                {"userId": "oid-2", "displayName": "Sam Peer", "email": "sam@acme.com"},
            ],
        }
    ],
    "/chats/chat-waiting/messages": [
        {
            "id": "cm-1",
            "createdDateTime": _iso(-20),
            "messageType": "message",
            "body": {"contentType": "text", "content": "Can you confirm the release window?"},
            "from": {"user": {"id": "oid-2", "displayName": "Sam Peer"}},
        }
    ],
}

SINGLE_RESOURCES: Dict[str, Dict[str, Any]] = {
    "/me": {
        "id": "oid-1",
        "displayName": "Alex Manager",
        "givenName": "Alex",
        "mail": "manager@acme.com",
        "userPrincipalName": "manager@acme.com",
        "jobTitle": "Operations Manager",
    },
    "/me/mailboxSettings": {"timeZone": "UTC"},
    "/me/mailFolders/inbox": {"unreadItemCount": 2, "totalItemCount": 3},
}


class FakeGraphClient:
    """Implements the subset of GraphClient the services actually call."""

    def __init__(self) -> None:
        self.calls: List[str] = []

    async def get(self, path: str, *, params=None, headers=None) -> Dict[str, Any]:
        self.calls.append(path)
        if path in SINGLE_RESOURCES:
            return SINGLE_RESOURCES[path]
        return {"value": GRAPH_DATA.get(path, [])}

    async def get_collection(self, path, *, params=None, headers=None, max_items=None, max_pages=10):
        self.calls.append(path)
        return list(GRAPH_DATA.get(path, []))[: max_items or None]

    async def try_get_collection(
        self, path: str, *, params=None, headers=None, max_items=None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        self.calls.append(path)
        if path not in GRAPH_DATA:
            return [], f"{path}: not available in this tenant"
        return list(GRAPH_DATA[path])[: max_items or None], None

    async def get_bytes(self, path: str, *, headers=None) -> Optional[bytes]:
        return None


@pytest.fixture
def assistant(user) -> AssistantService:
    return AssistantService(FakeGraphClient(), user)


@pytest.mark.asyncio
async def test_collect_gathers_every_source(assistant):
    snapshot = await assistant.collect()

    assert snapshot.profile.display_name == "Alex Manager"
    assert snapshot.profile.job_title == "Operations Manager"
    assert len(snapshot.emails) == 3
    assert snapshot.agenda is not None and snapshot.agenda.total_meetings == 2
    assert {task.id for task in snapshot.tasks} == {"task-overdue", "task-later"}
    assert snapshot.task_summary.overdue == 1
    assert len(snapshot.conversations) == 1
    assert snapshot.unread_email_count == 2
    assert "conv-cc" in snapshot.replied_thread_keys


@pytest.mark.asyncio
async def test_priorities_rank_across_sources(assistant):
    result = await assistant.get_priorities(limit=20)

    assert result.items, "unified list must not be empty"
    assert result.strategy == "rules-v1"

    ranks = {item.id: item.rank for item in result.items}
    scores = {item.id: item.score for item in result.items}

    # The imminent incident review outranks everything else.
    assert result.items[0].source is SourceType.MEETING
    assert result.items[0].source_id == "evt-soon"
    assert result.items[0].bucket.value == "critical"

    # A VIP asking for sign-off beats an "URGENT" newsletter.
    assert scores["email:mail-vip"] > scores["email:mail-newsletter"]
    assert ranks["email:mail-vip"] < ranks["email:mail-newsletter"]

    # An already-answered FYI where the user was only CC'd sinks.
    assert scores["email:mail-cc"] < scores["email:mail-vip"]

    # The overdue task is never demoted below "high".
    overdue = next(item for item in result.items if item.source_id == "task-overdue")
    assert overdue.score >= 70.0

    # Completed work is excluded entirely.
    assert not any(item.source_id == "task-done" for item in result.items)


@pytest.mark.asyncio
async def test_daily_brief_assembles_every_section(assistant):
    brief = await assistant.get_daily_brief()

    assert brief.greeting.startswith("Good ")
    assert "meeting" in brief.headline.lower() or "overdue" in brief.headline.lower()

    assert [event.subject for event in brief.meetings] == ["Incident review", "1:1 with Sam"]
    assert brief.pending_tasks and brief.pending_tasks[0].id == "task-overdue"
    assert brief.important_emails
    assert brief.important_emails[0].id == "mail-vip"
    assert brief.important_conversations
    assert brief.priorities

    stats = brief.stats
    assert stats.meetings_today == 2
    assert stats.overdue_tasks == 1
    assert stats.pending_tasks == 2
    assert stats.conversations_waiting_on_me == 1
    assert stats.critical_items >= 1

    # No LLM configured -> deterministic output, no invented narrative.
    assert brief.ai_generated is False
    assert brief.narrative is None


@pytest.mark.asyncio
async def test_user_summary_recommends_focus(assistant):
    summary = await assistant.get_user_summary()

    assert summary.profile.display_name == "Alex Manager"
    assert summary.highlights
    assert 0 < len(summary.recommended_focus) <= 5
    assert summary.recommended_focus[0].rank == 1
    assert summary.stats.pending_tasks == 2


@pytest.mark.asyncio
async def test_personal_account_skips_teams_without_calling_graph(user):
    """Graph answers a bare 401 for consumer accounts, so never ask."""
    user.ms_tenant_id = "9188040d-6c67-4c5b-b112-36a304b66dad"  # MSA tenant
    user.granted_scopes = ["User.Read", "Mail.Read", "Calendars.Read"]
    client = FakeGraphClient()
    service = AssistantService(client, user)

    brief = await service.get_daily_brief()

    assert "/me/chats" not in client.calls, "must not call an endpoint that cannot work"
    assert brief.important_conversations == []
    assert brief.meetings, "other sources keep working"
    assert any("work or school account" in warning for warning in brief.warnings)


@pytest.mark.asyncio
async def test_graph_401_on_chats_degrades_instead_of_forcing_relogin(user):
    """A per-resource 401 must not look like an expired session."""
    from app.core.exceptions import ReauthRequiredError

    client = FakeGraphClient()
    original = client.try_get_collection

    async def reject_chats(path, **kwargs):
        if path == "/me/chats":
            raise ReauthRequiredError("Microsoft rejected the access token.")
        return await original(path, **kwargs)

    client.try_get_collection = reject_chats
    service = AssistantService(client, user)

    brief = await service.get_daily_brief()

    assert brief.important_conversations == []
    assert brief.meetings
    assert any("Teams" in warning for warning in brief.warnings)


@pytest.mark.asyncio
async def test_missing_chat_scope_is_reported(user):
    user.granted_scopes = ["User.Read", "Mail.Read", "Calendars.Read", "Tasks.ReadWrite"]
    service = AssistantService(FakeGraphClient(), user)

    conversations = await service.chat_service.get_conversations()

    assert conversations == []
    assert any("Chat.Read" in warning for warning in service.chat_service.warnings)


@pytest.mark.asyncio
async def test_missing_source_degrades_to_warning(user):
    """A tenant without Teams consent must still get a brief."""
    client = FakeGraphClient()
    original = client.try_get_collection

    async def fail_chats(path, **kwargs):
        if path == "/me/chats":
            return [], "/me/chats: Forbidden"
        return await original(path, **kwargs)

    client.try_get_collection = fail_chats
    service = AssistantService(client, user)

    brief = await service.get_daily_brief()

    assert brief.important_conversations == []
    assert brief.meetings, "other sources keep working"
    assert any("Chat.Read" in warning for warning in brief.warnings)
