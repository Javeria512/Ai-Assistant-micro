"""Weight configuration for the Single Unified Priority system.

Scores are a weighted average of normalised signals, so weights are directly
comparable across sources: raising ``email.sender_authority`` makes messages
from important people outrank everything else, without touching the code.

Users can override any subset via ``User.priority_weights``:

    {"email": {"sender_authority": 3.0}, "task": {"time_pressure": 4.0}}
"""

from __future__ import annotations

from copy import deepcopy
from typing import Dict, Mapping, Optional

from app.schemas.common import SourceType

# Canonical signal vocabulary shared by every source.
SIGNAL_TIME_PRESSURE = "time_pressure"
SIGNAL_EXPLICIT_IMPORTANCE = "explicit_importance"
SIGNAL_DIRECT_TARGETING = "direct_targeting"
SIGNAL_SENDER_AUTHORITY = "sender_authority"
SIGNAL_UNRESOLVED = "unresolved"
SIGNAL_URGENCY_LANGUAGE = "urgency_language"
SIGNAL_ENGAGEMENT_SCOPE = "engagement_scope"
SIGNAL_STALENESS = "staleness"
SIGNAL_CONFLICT = "conflict"

SIGNAL_LABELS: Dict[str, str] = {
    SIGNAL_TIME_PRESSURE: "Time pressure",
    SIGNAL_EXPLICIT_IMPORTANCE: "Marked important",
    SIGNAL_DIRECT_TARGETING: "Addressed to you",
    SIGNAL_SENDER_AUTHORITY: "Who it is from",
    SIGNAL_UNRESOLVED: "Still needs action",
    SIGNAL_URGENCY_LANGUAGE: "Urgent wording",
    SIGNAL_ENGAGEMENT_SCOPE: "How personal it is",
    SIGNAL_STALENESS: "Waiting too long",
    SIGNAL_CONFLICT: "Schedule conflict",
}

DEFAULT_WEIGHTS: Dict[str, Dict[str, float]] = {
    SourceType.EMAIL.value: {
        SIGNAL_TIME_PRESSURE: 1.2,
        SIGNAL_EXPLICIT_IMPORTANCE: 1.6,
        SIGNAL_DIRECT_TARGETING: 2.0,
        SIGNAL_SENDER_AUTHORITY: 2.2,
        SIGNAL_UNRESOLVED: 2.0,
        SIGNAL_URGENCY_LANGUAGE: 1.8,
        SIGNAL_ENGAGEMENT_SCOPE: 0.8,
        SIGNAL_STALENESS: 1.2,
    },
    SourceType.MEETING.value: {
        SIGNAL_TIME_PRESSURE: 3.0,
        SIGNAL_EXPLICIT_IMPORTANCE: 1.0,
        SIGNAL_DIRECT_TARGETING: 1.5,
        SIGNAL_SENDER_AUTHORITY: 1.5,
        SIGNAL_UNRESOLVED: 1.2,
        SIGNAL_URGENCY_LANGUAGE: 0.6,
        SIGNAL_ENGAGEMENT_SCOPE: 0.8,
        SIGNAL_CONFLICT: 1.5,
    },
    SourceType.TASK.value: {
        SIGNAL_TIME_PRESSURE: 3.0,
        SIGNAL_EXPLICIT_IMPORTANCE: 2.0,
        SIGNAL_DIRECT_TARGETING: 0.6,
        SIGNAL_UNRESOLVED: 1.0,
        SIGNAL_URGENCY_LANGUAGE: 1.2,
        SIGNAL_STALENESS: 0.8,
    },
    SourceType.CHAT.value: {
        SIGNAL_TIME_PRESSURE: 1.5,
        SIGNAL_EXPLICIT_IMPORTANCE: 1.0,
        SIGNAL_DIRECT_TARGETING: 2.2,
        SIGNAL_SENDER_AUTHORITY: 1.8,
        SIGNAL_UNRESOLVED: 2.4,
        SIGNAL_URGENCY_LANGUAGE: 1.6,
        SIGNAL_ENGAGEMENT_SCOPE: 0.6,
        SIGNAL_STALENESS: 1.0,
    },
}

# Bucket thresholds on the 0-100 scale.
BUCKET_THRESHOLDS = {"critical": 78.0, "high": 58.0, "medium": 38.0}

# Hard rules applied after the weighted average.
FLOOR_MEETING_IMMINENT = 88.0        # meeting starts within 15 minutes
FLOOR_MEETING_IN_PROGRESS = 92.0     # meeting is happening right now
FLOOR_OVERDUE_TASK = 70.0            # a missed deadline is never "medium"
FLOOR_VIP_DIRECT = 65.0              # unread and addressed to you by a VIP
AUTOMATED_EMAIL_MULTIPLIER = 0.45    # newsletters/no-reply never crowd the list


def resolve_weights(
    overrides: Optional[Mapping[str, Mapping[str, float]]] = None,
) -> Dict[str, Dict[str, float]]:
    """Merge per-user overrides on top of the defaults."""
    merged = deepcopy(DEFAULT_WEIGHTS)
    for source, signals in (overrides or {}).items():
        if source not in merged or not isinstance(signals, Mapping):
            continue
        for signal, weight in signals.items():
            if signal in merged[source]:
                try:
                    merged[source][signal] = max(0.0, float(weight))
                except (TypeError, ValueError):
                    continue
    return merged


def signal_label(name: str) -> str:
    return SIGNAL_LABELS.get(name, name.replace("_", " ").capitalize())
