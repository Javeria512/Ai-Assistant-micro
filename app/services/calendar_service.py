"""Calendar retrieval plus agenda/conflict processing."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from app.core.config import get_settings
from app.integrations.microsoft import endpoints
from app.integrations.microsoft.mappers import map_event
from app.schemas.calendar import CalendarEvent, DailyAgenda, MeetingConflict
from app.utils.datetime_utils import (
    day_bounds,
    ensure_aware,
    local_date,
    minutes_between,
    to_graph_filter_datetime,
    utcnow,
)
from app.services.base import GraphService

logger = logging.getLogger(__name__)
settings = get_settings()

# Meetings the user declined or that are cancelled are noise on a daily agenda.
_IGNORED_RESPONSES = {"declined"}


class CalendarService(GraphService):
    async def get_events(
        self,
        *,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: int = 100,
        include_declined: bool = False,
    ) -> List[CalendarEvent]:
        """Expanded calendar view (recurrences resolved into occurrences)."""
        now = utcnow()
        start = ensure_aware(start) or now
        end = ensure_aware(end) or start + timedelta(days=settings.CALENDAR_LOOKAHEAD_DAYS)

        payloads, warning = await self.client.try_get_collection(
            endpoints.ME_CALENDAR_VIEW,
            params={
                "startDateTime": to_graph_filter_datetime(start),
                "endDateTime": to_graph_filter_datetime(end),
                "$select": endpoints.EVENT_SELECT,
                "$orderby": "start/dateTime",
                "$top": min(limit, 100),
            },
            headers={"Prefer": f"{endpoints.PREFER_UTC}, {endpoints.PREFER_TEXT_BODY}"},
            max_items=limit,
        )
        self._warn(warning)

        events = [map_event(payload, identity=self.identity, now=now) for payload in payloads]
        if not include_declined:
            events = [
                event
                for event in events
                if not event.is_cancelled
                and (event.response_status or "none") not in _IGNORED_RESPONSES
            ]

        events.sort(key=lambda event: (event.start is None, event.start or now))
        return self.annotate_conflicts(events)

    async def get_today(self, *, reference: Optional[datetime] = None) -> DailyAgenda:
        """Everything scheduled for the user's local day."""
        start, end = day_bounds(reference, self.timezone)
        events = await self.get_events(start=start, end=end, limit=100)
        return self.build_agenda(events, start=start, timezone_name=self.timezone)

    # --------------------------------------------------------------- processing
    @staticmethod
    def annotate_conflicts(events: List[CalendarEvent]) -> List[CalendarEvent]:
        """Flag events whose time ranges overlap another event."""
        timed = [
            event
            for event in events
            if event.start and event.end and not event.is_all_day
        ]
        for index, event in enumerate(timed):
            for other in timed[index + 1 :]:
                if other.start >= event.end:
                    break  # sorted by start: nothing later can overlap
                if other.start < event.end and event.start < other.end:
                    event.has_conflict = True
                    other.has_conflict = True
                    if other.subject not in event.conflicts_with:
                        event.conflicts_with.append(other.subject)
                    if event.subject not in other.conflicts_with:
                        other.conflicts_with.append(event.subject)
        return events

    @staticmethod
    def find_conflicts(events: List[CalendarEvent]) -> List[MeetingConflict]:
        conflicts: List[MeetingConflict] = []
        timed = [
            event for event in events if event.start and event.end and not event.is_all_day
        ]
        for index, event in enumerate(timed):
            for other in timed[index + 1 :]:
                if other.start >= event.end:
                    break
                overlap_end = min(event.end, other.end)
                overlap = minutes_between(other.start, overlap_end) or 0.0
                if overlap > 0:
                    conflicts.append(
                        MeetingConflict(first=event, second=other, overlap_minutes=overlap)
                    )
        return conflicts

    @staticmethod
    def _largest_gap(events: List[CalendarEvent]) -> Optional[float]:
        timed = sorted(
            (event for event in events if event.start and event.end and not event.is_all_day),
            key=lambda event: event.start,
        )
        if len(timed) < 2:
            return None
        largest = 0.0
        cursor = timed[0].end
        for event in timed[1:]:
            gap = minutes_between(cursor, event.start) or 0.0
            largest = max(largest, gap)
            cursor = max(cursor, event.end)
        return largest

    def build_agenda(
        self,
        events: List[CalendarEvent],
        *,
        start: Optional[datetime] = None,
        timezone_name: Optional[str] = None,
    ) -> DailyAgenda:
        now = utcnow()
        timezone_name = timezone_name or self.timezone
        start = start or now

        timed = [event for event in events if event.start and event.end]
        total_minutes = sum(event.duration_minutes or 0.0 for event in timed if not event.is_all_day)
        upcoming = [event for event in timed if event.end and event.end > now]

        agenda_date = local_date(start or now, timezone_name) or now.date()
        return DailyAgenda(
            date=agenda_date.isoformat(),
            timezone=timezone_name,
            events=events,
            total_meetings=len(events),
            total_meeting_minutes=round(total_minutes, 1),
            first_meeting_at=timed[0].start if timed else None,
            last_meeting_end_at=max((event.end for event in timed), default=None),
            next_meeting=upcoming[0] if upcoming else None,
            conflicts=self.find_conflicts(events),
            busiest_gap_minutes=self._largest_gap(events),
            warnings=list(self.warnings),
        )

    async def get_next_meeting(self) -> Tuple[Optional[CalendarEvent], List[CalendarEvent]]:
        """``(next meeting, today's meetings)`` - used by the summary endpoints."""
        agenda = await self.get_today()
        return agenda.next_meeting, agenda.events
