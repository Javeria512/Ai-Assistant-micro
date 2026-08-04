"""Schemas for the Single Unified Priority system.

Every activity from Outlook, Calendar, Teams and Tasks is normalised into a
``PriorityItem`` so one ranked list can span all sources. Scores are always
explainable: each item carries the signals that produced it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema, Person, PriorityBucket, SourceType
from app.utils.datetime_utils import utcnow


class SignalScore(BaseSchema):
    """One scoring dimension's contribution to an item's final score."""

    name: str
    value: float = Field(ge=0.0, le=1.0, description="Normalised signal strength 0-1.")
    weight: float = Field(ge=0.0, description="Weight applied for this source type.")
    contribution: float = Field(description="value * weight, before normalisation.")
    note: Optional[str] = Field(default=None, description="Human-readable justification.")


class PriorityItem(BaseSchema):
    """A single ranked unit of work, regardless of which system it came from."""

    id: str = Field(description="Stable composite id, e.g. 'email:AAMk...'.")
    source: SourceType
    source_id: str

    title: str
    subtitle: Optional[str] = None
    snippet: str = ""

    actors: List[Person] = Field(
        default_factory=list, description="Who this involves (sender, organizer, assignee)."
    )

    occurred_at: Optional[datetime] = Field(
        default=None, description="When it happened (received/created/last activity)."
    )
    due_at: Optional[datetime] = Field(
        default=None, description="When it must be handled (due date / meeting start)."
    )

    score: float = Field(ge=0.0, le=100.0)
    bucket: PriorityBucket
    rank: int = 0

    reasons: List[str] = Field(
        default_factory=list, description="Top explanations, ready to show in the UI."
    )
    signals: List[SignalScore] = Field(default_factory=list)

    action_hint: Optional[str] = Field(
        default=None, description="Suggested next action, e.g. 'Reply', 'Join', 'Complete'."
    )
    deep_link: Optional[str] = Field(default=None, description="Open in Outlook/Teams/Planner.")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BucketCounts(BaseSchema):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class SourceCounts(BaseSchema):
    email: int = 0
    meeting: int = 0
    task: int = 0
    chat: int = 0


class PriorityList(BaseSchema):
    """The unified, ranked worklist."""

    generated_at: datetime = Field(default_factory=utcnow)
    timezone: str = "UTC"
    items: List[PriorityItem] = Field(default_factory=list)
    total_considered: int = 0
    buckets: BucketCounts = Field(default_factory=BucketCounts)
    sources: SourceCounts = Field(default_factory=SourceCounts)
    strategy: str = Field(
        default="rules-v1",
        description="Which scoring strategy produced this list (rules-v1, llm-reranked-v1, ...).",
    )
    warnings: List[str] = Field(default_factory=list)


class PriorityWeightsView(BaseSchema):
    """Read-only view of the weights currently in effect for a user."""

    defaults: Dict[str, Dict[str, float]]
    overrides: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    effective: Dict[str, Dict[str, float]]
