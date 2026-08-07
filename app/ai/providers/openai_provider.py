"""OpenAI-compatible chat completions provider.

Implemented over the shared ``httpx`` client rather than the vendor SDK so the
container stays light and any OpenAI-compatible endpoint (Azure OpenAI gateway,
vLLM, OpenRouter) works by changing ``OPENAI_BASE_URL``.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.ai.base import ChatMessage
from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class OpenAIProvider:
    name = "openai"

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        *,
        settings: Optional[Settings] = None,
    ) -> None:
        self._http = http_client
        self._settings = settings or get_settings()

    @property
    def available(self) -> bool:
        return bool(self._settings.OPENAI_API_KEY)

    async def complete(
        self,
        messages: List[ChatMessage],
        *,
        max_tokens: Optional[int] = None,
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> Optional[str]:
        if not self.available:
            return None

        payload: Dict[str, Any] = {
            "model": self._settings.llm_model,
            "messages": [dict(message) for message in messages],
            "temperature": temperature,
            "max_tokens": max_tokens or self._settings.LLM_MAX_OUTPUT_TOKENS,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        url = f"{self._settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
        try:
            response = await self._http.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=self._settings.LLM_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            logger.warning("LLM request failed: %s", exc)
            return None

        if response.status_code >= 400:
            logger.warning(
                "LLM returned %s: %s", response.status_code, response.text[:300]
            )
            return None

        try:
            body = response.json()
            return body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError):
            logger.warning("Unexpected LLM response shape.")
            return None
