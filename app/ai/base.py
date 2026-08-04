"""LLM provider abstraction.

The assistant is useful without an LLM: every endpoint returns deterministic,
rule-based output. Configuring a provider upgrades the *same* endpoints with
generated narrative and reranking - no route or schema changes.

Add a provider by implementing :class:`LLMProvider` and registering it in
``app.ai.factory``.
"""

from __future__ import annotations

import logging
from typing import List, Optional, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


class ChatMessage(dict):
    """Minimal provider-agnostic message ({"role": ..., "content": ...})."""

    def __init__(self, role: str, content: str) -> None:
        super().__init__(role=role, content=content)


@runtime_checkable
class LLMProvider(Protocol):
    """Everything the application needs from a language model."""

    name: str

    @property
    def available(self) -> bool:
        """False when the provider is not configured; callers then fall back."""
        ...

    async def complete(
        self,
        messages: List[ChatMessage],
        *,
        max_tokens: Optional[int] = None,
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> Optional[str]:
        """Return the model's text, or ``None`` if the call could not be made."""
        ...


def system_message(content: str) -> ChatMessage:
    return ChatMessage("system", content)


def user_message(content: str) -> ChatMessage:
    return ChatMessage("user", content)
