"""Assistant-level endpoints: unified priorities, daily brief, user summary."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_assistant_service, get_current_user
from app.models.user import User
from app.schemas.assistant import DailyBrief, UserSummary
from app.schemas.common import SourceType
from app.schemas.priority import PriorityList, PriorityWeightsView
from app.services.assistant_service import AssistantService
from app.services.priority.weights import DEFAULT_WEIGHTS, resolve_weights

router = APIRouter(prefix="/assistant", tags=["Assistant"])


@router.get(
    "/priorities",
    response_model=PriorityList,
    summary="Single Unified Priority list",
)
async def read_priorities(
    limit: int = Query(30, ge=1, le=100),
    sources: Optional[List[SourceType]] = Query(
        None, description="Restrict to email, meeting, task and/or chat."
    ),
    use_ai: bool = Query(
        False,
        description="Apply the LLM reranking stage (no-op unless LLM_PROVIDER is set).",
    ),
    service: AssistantService = Depends(get_assistant_service),
) -> PriorityList:
    """One ranked worklist spanning Outlook, Calendar, Teams and Tasks.

    Every item carries its score, bucket and the signals that produced them, so
    the ranking is auditable rather than a black box.
    """
    return await service.get_priorities(limit=limit, sources=sources, use_ai=use_ai)


@router.get("/daily-brief", response_model=DailyBrief, summary="Full daily brief")
async def read_daily_brief(
    use_ai: bool = Query(True, description="Include the AI narrative when configured."),
    service: AssistantService = Depends(get_assistant_service),
) -> DailyBrief:
    """Everything the dashboard needs in one call.

    Meetings, pending tasks, important emails, important conversations and the
    unified priority list, fetched concurrently and degrading per source.
    """
    return await service.get_daily_brief(use_ai=use_ai)


@router.get("/summary", response_model=UserSummary, summary="User summary")
async def read_user_summary(
    use_ai: bool = Query(True),
    service: AssistantService = Depends(get_assistant_service),
) -> UserSummary:
    """A short status of the user's day plus the items to focus on next."""
    return await service.get_user_summary(use_ai=use_ai)


@router.get(
    "/priority-weights",
    response_model=PriorityWeightsView,
    summary="Inspect the scoring weights in effect",
)
async def read_priority_weights(user: User = Depends(get_current_user)) -> PriorityWeightsView:
    overrides = dict(user.priority_weights or {})
    return PriorityWeightsView(
        defaults=DEFAULT_WEIGHTS,
        overrides=overrides,
        effective=resolve_weights(overrides),
    )
