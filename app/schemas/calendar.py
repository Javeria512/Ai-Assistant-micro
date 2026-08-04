"""Calendar / meeting schemas."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema, Person


class Attendee(BaseSchema):
    name: Optional[str] = None
    address: Optional[str] = None
    type: Optional[str] = Field(default=None, description="required | optional | resource")
    response: Optional[str] = Field(
        default=None, description="none | accepted | declined | tentativelyAccepted"
    )


class CalendarEvent(BaseSchema):
    id: str
    subject: str = "(no subject)"
    preview: str = ""

    start: Optional[datetime] = None
    end: Optional[datetime] = None
    is_all_day: bool = False
    duration_minutes: Optional[float] = None
    starts_in_minutes: Optional[float] = None

    organizer: Optional[Person] = None
    is_organizer: bool = False
    location: Optional[str] = None

    is_online_meeting: bool = False
    join_url: Optional[str] = None
    online_meeting_provider: Optional[str] = None

    attendees: List[Attendee] = Field(default_factory=list)
    attendee_count: int = 0
    required_attendee_count: int = 0
    user_is_required: bool = True
    response_status: Optional[str] = None
    needs_response: bool = False

    importance: str = "normal"
    sensitivity: Optional[str] = None
    show_as: Optional[str] = None
    is_cancelled: bool = False
    is_recurring: bool = False
    categories: List[str] = Field(default_factory=list)
    web_link: Optional[str] = None

    # Populated by the calendar service after the full day is loaded.
    has_conflict: bool = False
    conflicts_with: List[str] = Field(default_factory=list)


class MeetingConflict(BaseSchema):
    first: CalendarEvent
    second: CalendarEvent
    overlap_minutes: float


class DailyAgenda(BaseSchema):
    date: str
    timezone: str
    events: List[CalendarEvent] = Field(default_factory=list)
    total_meetings: int = 0
    total_meeting_minutes: float = 0.0
    first_meeting_at: Optional[datetime] = None
    last_meeting_end_at: Optional[datetime] = None
    next_meeting: Optional[CalendarEvent] = None
    conflicts: List[MeetingConflict] = Field(default_factory=list)
    busiest_gap_minutes: Optional[float] = Field(
        default=None, description="Largest free block between meetings, in minutes."
    )
    warnings: List[str] = Field(default_factory=list)
