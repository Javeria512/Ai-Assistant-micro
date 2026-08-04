"""Calendar and meeting endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_calendar_service
from app.schemas.calendar import CalendarEvent, DailyAgenda, MeetingConflict
from app.schemas.common import Collection
from app.services.calendar_service import CalendarService
from app.utils.datetime_utils import utcnow

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get(
    "/today",
    response_model=DailyAgenda,
    summary="Daily meetings",
)
async def read_today(
    service: CalendarService = Depends(get_calendar_service),
) -> DailyAgenda:
    """Today's agenda in the user's timezone, with conflicts and free gaps."""
    return await service.get_today()


@router.get(
    "/events",
    response_model=Collection[CalendarEvent],
    summary="Calendar events in a window",
)
async def list_events(
    start: Optional[datetime] = Query(None, description="Defaults to now."),
    end: Optional[datetime] = Query(None, description="Defaults to start + 7 days."),
    limit: int = Query(50, ge=1, le=100),
    include_declined: bool = Query(False),
    service: CalendarService = Depends(get_calendar_service),
) -> Collection[CalendarEvent]:
    events = await service.get_events(
        start=start, end=end, limit=limit, include_declined=include_declined
    )
    return Collection.of(events, service.warnings)


@router.get(
    "/conflicts",
    response_model=Collection[MeetingConflict],
    summary="Overlapping meetings",
)
async def list_conflicts(
    days: int = Query(1, ge=1, le=14, description="Look-ahead window in days."),
    service: CalendarService = Depends(get_calendar_service),
) -> Collection[MeetingConflict]:
    now = utcnow()
    events = await service.get_events(start=now, end=now + timedelta(days=days), limit=100)
    conflicts: List[MeetingConflict] = service.find_conflicts(events)
    return Collection.of(conflicts, service.warnings)
