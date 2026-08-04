"""Optional LLM reranking stage for the unified priority list.

This is the seam described in the project documentation: the deterministic
engine produces the list, and the model is only allowed to *nudge* scores with
a bounded delta and a stated reason. It can never introduce items, drop items,
or move something to the top without explaining why.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from app.ai.base import LLMProvider, system_message, user_message
from app.ai.prompts.templates import EXECUTIVE_ASSISTANT_SYSTEM, build_rerank_prompt
from app.schemas.priority import PriorityItem
from app.services.priority.signals import PriorityContext

logger = logging.getLogger(__name__)

MAX_ITEMS_TO_RERANK = 25
MAX_ABS_DELTA = 25.0


class LLMPriorityReranker:
    """Applies bounded, explained score adjustments from the model."""

    name = "llm-reranked-v1"

    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider

    @staticmethod
    def _to_payload(items: List[PriorityItem]) -> List[Dict[str, Any]]:
        return [
            {
                "id": item.id,
                "source": item.source.value,
                "title": item.title,
                "snippet": item.snippet[:200],
                "score": item.score,
                "reasons": item.reasons,
                "due_at": item.due_at.isoformat() if item.due_at else None,
            }
            for item in items
        ]

    async def rerank(
        self, items: List[PriorityItem], context: PriorityContext
    ) -> List[PriorityItem]:
        if not self._provider.available or not items:
            return items

        candidates = sorted(items, key=lambda item: item.score, reverse=True)[
            :MAX_ITEMS_TO_RERANK
        ]
        response = await self._provider.complete(
            [
                system_message(EXECUTIVE_ASSISTANT_SYSTEM),
                user_message(build_rerank_prompt(self._to_payload(candidates))),
            ],
            json_mode=True,
            temperature=0.0,
        )
        if not response:
            return items

        try:
            adjustments = json.loads(response).get("adjustments") or []
        except (ValueError, AttributeError):
            logger.warning("Reranker returned non-JSON output; keeping rule-based order.")
            return items

        by_id = {item.id: item for item in items}
        applied = 0
        for adjustment in adjustments:
            if not isinstance(adjustment, dict):
                continue
            item = by_id.get(adjustment.get("id"))
            if item is None:
                continue
            try:
                delta = float(adjustment.get("delta") or 0.0)
            except (TypeError, ValueError):
                continue

            delta = max(-MAX_ABS_DELTA, min(MAX_ABS_DELTA, delta))
            if delta == 0.0:
                continue

            item.score = round(max(0.0, min(100.0, item.score + delta)), 2)
            reason = str(adjustment.get("reason") or "").strip()
            if reason:
                item.reasons.append(f"AI: {reason}")
            applied += 1

        logger.info("Reranker applied %s adjustment(s).", applied)
        return items
