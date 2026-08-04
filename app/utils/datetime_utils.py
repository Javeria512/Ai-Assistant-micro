"""Datetime helpers.

Every timestamp inside the application is timezone-aware UTC. Graph returns ISO
strings (sometimes without an offset); SQLite returns naive datetimes. These
helpers normalise both cases so comparisons never raise.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc


def utcnow() -> datetime:
    return datetime.now(UTC)


def ensure_aware(value: Optional[datetime]) -> Optional[datetime]:
    """Attach UTC to naive datetimes; pass through aware ones."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def parse_graph_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse the ISO-8601 timestamps Microsoft Graph returns.

    Handles trailing ``Z``, fractional seconds longer than 6 digits, and the
    offset-less form used inside ``dateTimeTimeZone`` objects.
    """
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    # Python's fromisoformat rejects more than 6 fractional digits.
    if "." in text:
        head, _, tail = text.partition(".")
        digits = ""
        rest = ""
        for index, char in enumerate(tail):
            if char.isdigit():
                digits += char
            else:
                rest = tail[index:]
                break
        text = f"{head}.{digits[:6]:0<6}{rest}" if digits else head + rest

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return ensure_aware(parsed)


def parse_graph_date_time_zone(payload: Optional[dict]) -> Optional[datetime]:
    """Parse Graph's ``dateTimeTimeZone`` object into aware UTC.

    Requests set ``Prefer: outlook.timezone="UTC"``, so the payload is normally
    already UTC; the named zone is honoured when present anyway.
    """
    if not payload:
        return None
    raw = payload.get("dateTime")
    if not raw:
        return None
    zone_name = payload.get("timeZone") or "UTC"

    parsed = parse_graph_datetime(raw)
    if parsed is None:
        return None

    # ``parse_graph_datetime`` assumes UTC for offset-less values. If Graph named
    # a different zone, re-interpret the wall-clock time in that zone.
    if "+" not in raw and "-" not in raw[10:] and not raw.endswith("Z"):
        tz = to_tzinfo(zone_name)
        if tz is not None and tz is not UTC:
            naive = parsed.replace(tzinfo=None)
            return naive.replace(tzinfo=tz).astimezone(UTC)
    return parsed


_WINDOWS_TZ_ALIASES = {
    "UTC": "UTC",
    "Pakistan Standard Time": "Asia/Karachi",
    "India Standard Time": "Asia/Kolkata",
    "GMT Standard Time": "Europe/London",
    "W. Europe Standard Time": "Europe/Berlin",
    "Central Europe Standard Time": "Europe/Budapest",
    "Romance Standard Time": "Europe/Paris",
    "Eastern Standard Time": "America/New_York",
    "Central Standard Time": "America/Chicago",
    "Mountain Standard Time": "America/Denver",
    "Pacific Standard Time": "America/Los_Angeles",
    "Arabian Standard Time": "Asia/Dubai",
    "Arab Standard Time": "Asia/Riyadh",
    "Singapore Standard Time": "Asia/Singapore",
    "China Standard Time": "Asia/Shanghai",
    "Tokyo Standard Time": "Asia/Tokyo",
    "AUS Eastern Standard Time": "Australia/Sydney",
}


def to_tzinfo(name: Optional[str]):
    """Best-effort conversion of an IANA or Windows zone name to ``tzinfo``."""
    if not name:
        return UTC
    candidate = _WINDOWS_TZ_ALIASES.get(name, name)
    try:
        return ZoneInfo(candidate)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return UTC


def to_iana_name(name: Optional[str], default: str = "UTC") -> str:
    """Normalise a Windows or IANA zone name to a storable IANA name."""
    if not name:
        return default
    candidate = _WINDOWS_TZ_ALIASES.get(name, name)
    resolved = to_tzinfo(candidate)
    return getattr(resolved, "key", default)


def day_bounds(
    reference: Optional[datetime] = None, tz_name: str = "UTC"
) -> Tuple[datetime, datetime]:
    """Start and end of the local day for ``reference``, returned in UTC."""
    tz = to_tzinfo(tz_name)
    now_local = (reference or utcnow()).astimezone(tz)
    start_local = datetime.combine(now_local.date(), time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def to_graph_filter_datetime(value: datetime) -> str:
    """Format for use inside a Graph ``$filter`` / ``startDateTime`` value."""
    return ensure_aware(value).strftime("%Y-%m-%dT%H:%M:%SZ")  # type: ignore[union-attr]


def minutes_between(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    start, end = ensure_aware(start), ensure_aware(end)
    if start is None or end is None:
        return None
    return (end - start).total_seconds() / 60.0


def hours_since(value: Optional[datetime], now: Optional[datetime] = None) -> Optional[float]:
    value = ensure_aware(value)
    if value is None:
        return None
    return ((now or utcnow()) - value).total_seconds() / 3600.0


def humanize_delta(target: Optional[datetime], now: Optional[datetime] = None) -> str:
    """Short relative description such as ``in 25m`` or ``2d ago``."""
    target = ensure_aware(target)
    if target is None:
        return "no date"
    now = now or utcnow()
    delta = target - now
    future = delta.total_seconds() >= 0
    seconds = abs(delta.total_seconds())

    if seconds < 60:
        text = "just now" if not future else "now"
        return text
    if seconds < 3600:
        value = f"{int(seconds // 60)}m"
    elif seconds < 86400:
        value = f"{int(seconds // 3600)}h"
    else:
        value = f"{int(seconds // 86400)}d"
    return f"in {value}" if future else f"{value} ago"


def local_date(value: Optional[datetime], tz_name: str = "UTC") -> Optional[date]:
    value = ensure_aware(value)
    if value is None:
        return None
    return value.astimezone(to_tzinfo(tz_name)).date()
