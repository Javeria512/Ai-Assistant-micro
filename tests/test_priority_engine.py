"""Behavioural tests for the Single Unified Priority engine."""

from __future__ import annotations

from datetime import timedelta

import pytest

from app.schemas.calendar import CalendarEvent
from app.schemas.chat import ChatParticipant, Conversation
from app.schemas.common import Person, PriorityBucket, SourceType
from app.schemas.mail import EmailMessage
from app.schemas.task import TaskItem, TaskSource
from app.services.priority.engine import PriorityEngine


def make_email(**overrides) -> EmailMessage:
    base = dict(
        id="msg-1",
        conversation_id="conv-1",
        subject="Quarterly report",
        clean_subject="Quarterly report",
        preview="Please take a look when you can.",
        sender=Person(name="Sam Peer", address="sam@acme.com"),
        to_recipients=[Person(name="Alex", address="manager@acme.com")],
        received_at=None,
        is_read=False,
        importance="normal",
        recipient_count=1,
        addressed_directly=True,
        age_hours=2.0,
    )
    base.update(overrides)
    return EmailMessage(**base)


def make_task(**overrides) -> TaskItem:
    base = dict(
        id="task-1",
        source=TaskSource.TODO,
        title="Prepare board deck",
        status="notStarted",
        importance="normal",
        has_due_date=True,
    )
    base.update(overrides)
    return TaskItem(**base)


def make_meeting(now, minutes_from_now: float, **overrides) -> CalendarEvent:
    start = now + timedelta(minutes=minutes_from_now)
    base = dict(
        id="evt-1",
        subject="Ops review",
        start=start,
        end=start + timedelta(minutes=30),
        duration_minutes=30.0,
        starts_in_minutes=minutes_from_now,
        organizer=Person(name="Sam Peer", address="sam@acme.com"),
        user_is_required=True,
        attendee_count=4,
        importance="normal",
    )
    base.update(overrides)
    return CalendarEvent(**base)


def make_conversation(**overrides) -> Conversation:
    base = dict(
        id="chat-1",
        chat_type="oneOnOne",
        last_message_preview="Can you confirm the release window?",
        last_message_from=ChatParticipant(name="Sam Peer", email="sam@acme.com"),
        participant_count=2,
        is_unread=True,
        waiting_on_me=True,
        age_hours=0.5,
        display_name="Sam Peer",
    )
    base.update(overrides)
    return Conversation(**base)


# --------------------------------------------------------------------- scoring
def test_vip_email_outranks_ordinary_email(context):
    engine = PriorityEngine()
    ordinary = engine.score_email(make_email(), context)
    vip = engine.score_email(
        make_email(id="msg-2", sender=Person(name="Chief", address="ceo@acme.com")),
        context,
    )
    assert vip.score > ordinary.score
    assert any("VIP" in reason for reason in vip.reasons)


def test_cc_only_scores_below_direct(context):
    engine = PriorityEngine()
    direct = engine.score_email(make_email(), context)
    copied = engine.score_email(
        make_email(id="msg-3", addressed_directly=False, is_cc_only=True), context
    )
    assert direct.score > copied.score


def test_automated_email_is_suppressed(context):
    engine = PriorityEngine()
    normal = engine.score_email(make_email(subject="URGENT: sign off needed"), context)
    automated = engine.score_email(
        make_email(
            id="msg-4",
            subject="URGENT: sign off needed",
            sender=Person(name="Notifications", address="noreply@vendor.com"),
            looks_automated=True,
        ),
        context,
    )
    assert automated.score < normal.score * 0.6


def test_urgent_wording_raises_score(context):
    engine = PriorityEngine()
    calm = engine.score_email(make_email(), context)
    urgent = engine.score_email(
        make_email(id="msg-5", subject="URGENT: production outage", preview="asap"),
        context,
    )
    assert urgent.score > calm.score


def test_overdue_task_never_below_high(context):
    engine = PriorityEngine()
    overdue = make_task(
        due_at=context.now - timedelta(days=2), is_overdue=True, days_until_due=-2.0
    )
    item = engine.score_task(overdue, context)
    assert item.score >= 70.0
    assert item.bucket in {PriorityBucket.CRITICAL, PriorityBucket.HIGH}
    assert any("Overdue" in reason for reason in item.reasons)


def test_imminent_meeting_is_critical(context):
    engine = PriorityEngine()
    item = engine.score_meeting(make_meeting(context.now, 10), context)
    assert item.score >= 88.0
    assert item.bucket is PriorityBucket.CRITICAL


def test_meeting_in_progress_beats_upcoming(context):
    engine = PriorityEngine()
    running = engine.score_meeting(make_meeting(context.now, -10), context)
    later = engine.score_meeting(make_meeting(context.now, 300, id="evt-2"), context)
    assert running.score > later.score


def test_chat_waiting_on_me_ranks_high(context):
    engine = PriorityEngine()
    waiting = engine.score_conversation(make_conversation(), context)
    quiet = engine.score_conversation(
        make_conversation(
            id="chat-2", is_unread=False, waiting_on_me=False, age_hours=40.0
        ),
        context,
    )
    assert waiting.score > quiet.score


def test_signals_and_reasons_are_explainable(context):
    engine = PriorityEngine()
    item = engine.score_email(make_email(), context)
    assert item.signals, "every item must expose its signals"
    assert item.reasons, "every item must expose human-readable reasons"
    assert all(0.0 <= signal.value <= 1.0 for signal in item.signals)
    assert item.signals == sorted(
        item.signals, key=lambda s: s.contribution, reverse=True
    )


def test_user_weight_overrides_change_ranking(context):
    ordinary = make_email()
    boosted_engine = PriorityEngine(
        weight_overrides={"email": {"sender_authority": 0.0, "urgency_language": 0.0}}
    )
    default_engine = PriorityEngine()

    assert boosted_engine.score_email(ordinary, context).score != pytest.approx(
        default_engine.score_email(ordinary, context).score
    )


# ------------------------------------------------------------------- pipeline
@pytest.mark.asyncio
async def test_build_produces_ranked_cross_source_list(context):
    engine = PriorityEngine()
    result = await engine.build(
        context,
        emails=[make_email(), make_email(id="msg-9", is_read=True)],
        meetings=[make_meeting(context.now, 10)],
        tasks=[
            make_task(due_at=context.now - timedelta(days=1), is_overdue=True),
            make_task(id="task-2", title="Later work", has_due_date=False),
        ],
        conversations=[make_conversation()],
        limit=10,
    )

    assert result.items, "the unified list must contain items"
    assert result.total_considered == 6
    assert [item.rank for item in result.items] == list(
        range(1, len(result.items) + 1)
    )
    scores = [item.score for item in result.items]
    assert scores == sorted(scores, reverse=True)

    sources = {item.source for item in result.items}
    assert sources == {
        SourceType.EMAIL,
        SourceType.MEETING,
        SourceType.TASK,
        SourceType.CHAT,
    }
    assert result.strategy == "rules-v1"


@pytest.mark.asyncio
async def test_completed_and_finished_items_are_dropped(context):
    engine = PriorityEngine()
    result = await engine.build(
        context,
        meetings=[make_meeting(context.now, -600)],  # ended long ago
        tasks=[make_task(is_completed=True, status="completed")],
        emails=[make_email(is_draft=True)],
    )
    assert result.items == []
