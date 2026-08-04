"""Graph payload -> schema mapping tests, using realistic Graph shapes."""

from __future__ import annotations

from app.integrations.microsoft.mappers import (
    GraphIdentity,
    map_conversation,
    map_email,
    map_event,
    map_planner_task,
    map_todo_task,
)

IDENTITY = GraphIdentity.build(
    object_id="oid-1", display_name="Alex Manager", addresses=["manager@acme.com"]
)


def test_map_email_derives_targeting_and_automation():
    payload = {
        "id": "AAMk123",
        "conversationId": "conv-1",
        "subject": "RE: Budget sign off",
        "bodyPreview": "Please approve by EOD. Unsubscribe here.",
        "importance": "high",
        "isRead": False,
        "hasAttachments": True,
        "receivedDateTime": "2026-07-30T09:15:22.1234567Z",
        "from": {"emailAddress": {"name": "No Reply", "address": "noreply@vendor.com"}},
        "toRecipients": [
            {"emailAddress": {"name": "Alex", "address": "Manager@acme.com"}}
        ],
        "ccRecipients": [{"emailAddress": {"address": "someone@acme.com"}}],
        "flag": {"flagStatus": "flagged"},
        "webLink": "https://outlook.office.com/mail/id/AAMk123",
    }

    message = map_email(payload, identity=IDENTITY)

    assert message.clean_subject == "Budget sign off"
    assert message.addressed_directly is True  # case-insensitive address match
    assert message.is_cc_only is False
    assert message.is_flagged is True
    assert message.looks_automated is True  # noreply@ + "unsubscribe"
    assert message.recipient_count == 2
    assert message.received_at is not None
    assert message.received_at.tzinfo is not None  # 7-digit fraction parsed fine


def test_map_event_resolves_timezone_and_attendees():
    payload = {
        "id": "evt-1",
        "subject": "Ops review",
        "bodyPreview": "Weekly sync",
        "start": {"dateTime": "2026-07-30T10:00:00.0000000", "timeZone": "UTC"},
        "end": {"dateTime": "2026-07-30T10:30:00.0000000", "timeZone": "UTC"},
        "isOrganizer": False,
        "organizer": {"emailAddress": {"name": "Sam", "address": "sam@acme.com"}},
        "attendees": [
            {
                "type": "required",
                "status": {"response": "none"},
                "emailAddress": {"address": "manager@acme.com"},
            },
            {
                "type": "optional",
                "status": {"response": "accepted"},
                "emailAddress": {"address": "other@acme.com"},
            },
        ],
        "responseStatus": {"response": "none"},
        "isOnlineMeeting": True,
        "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/x"},
        "location": {"displayName": "Room 2"},
    }

    event = map_event(payload, identity=IDENTITY)

    assert event.duration_minutes == 30.0
    assert event.user_is_required is True
    assert event.required_attendee_count == 1
    assert event.needs_response is True
    assert event.join_url.startswith("https://teams.microsoft.com")
    assert event.location == "Room 2"


def test_map_todo_task_flags_overdue():
    payload = {
        "id": "todo-1",
        "title": "Send weekly report",
        "status": "notStarted",
        "importance": "high",
        "createdDateTime": "2026-07-01T08:00:00Z",
        "dueDateTime": {"dateTime": "2026-07-02T00:00:00.0000000", "timeZone": "UTC"},
        "body": {"contentType": "html", "content": "<p>Include <b>KPIs</b></p>"},
    }

    task = map_todo_task(payload, list_id="l1", list_name="Work")

    assert task.is_overdue is True
    assert task.has_due_date is True
    assert task.list_name == "Work"
    assert task.notes == "Include KPIs"  # html stripped


def test_map_planner_task_maps_priority_band():
    payload = {
        "id": "plan-task-1",
        "planId": "plan-1",
        "title": "Migrate storage",
        "percentComplete": 50,
        "priority": 1,
        "dueDateTime": "2030-01-01T00:00:00Z",
    }

    task = map_planner_task(payload, plan_names={"plan-1": "Ops Plan"}, tenant_id="t1")

    assert task.importance == "high"
    assert task.status == "inProgress"
    assert task.list_name == "Ops Plan"
    assert task.web_link == "https://tasks.office.com/t1/Home/Task/plan-task-1"


def test_map_conversation_detects_waiting_on_me():
    payload = {
        "id": "chat-1",
        "chatType": "oneOnOne",
        "topic": None,
        "lastUpdatedDateTime": "2026-07-30T09:00:00Z",
        "viewpoint": {"lastMessageReadDateTime": "2026-07-30T08:00:00Z"},
        "lastMessagePreview": {
            "id": "m1",
            "createdDateTime": "2026-07-30T09:00:00Z",
            "body": {"contentType": "html", "content": "<div>Any update?</div>"},
            "from": {"user": {"id": "oid-2", "displayName": "Sam Peer"}},
        },
        "members": [
            {"userId": "oid-1", "displayName": "Alex Manager", "email": "manager@acme.com"},
            {"userId": "oid-2", "displayName": "Sam Peer", "email": "sam@acme.com"},
        ],
    }

    conversation = map_conversation(payload, identity=IDENTITY)

    assert conversation.is_unread is True
    assert conversation.waiting_on_me is True
    assert conversation.last_message_from_me is False
    assert conversation.display_name == "Sam Peer"  # named after the other person
    assert conversation.last_message_preview == "Any update?"
