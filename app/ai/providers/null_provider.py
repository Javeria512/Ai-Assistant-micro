"""No-op provider used whenever no LLM is configured."""

from __future__ import annotations

from typing import List, Optional

from app.ai.base import ChatMessage


class NullLLMProvider:
    """Always unavailable; every caller falls back to deterministic output."""

    name = "none"

    @property
    def available(self) -> bool:
        return False

    async def complete(
        self,
        messages: List[ChatMessage],
        *,
        max_tokens: Optional[int] = None,
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> Optional[str]:
        return None
