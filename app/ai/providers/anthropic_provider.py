"""Anthropic (Claude) Messages API provider.

Unlike :mod:`app.ai.providers.openai_provider`, which speaks raw HTTP over the
shared ``httpx`` client so any OpenAI-compatible gateway works, this provider
uses the official ``anthropic`` SDK. The SDK owns retry/backoff on 429 and 5xx,
typed exceptions, and the request shape — which matters here because the current
Claude models reject several parameters older code still sends (see below).

Three model-specific details this provider has to get right:

* **No sampling parameters.** ``temperature``, ``top_p`` and ``top_k`` are
  rejected with a 400 on Claude Opus 5 and its generation. The ``complete()``
  contract still accepts ``temperature`` because the OpenAI provider needs it,
  so we take it and deliberately drop it.
* **Thinking is on by default** and is billed against ``max_tokens`` alongside
  the reply, so the cap has to leave room for both or the answer truncates
  mid-sentence. Depth is steered with ``output_config.effort`` instead of a
  token budget.
* **Requests can be declined.** Safety classifiers return a normal 200 with
  ``stop_reason == "refusal"`` and an empty/partial ``content``, so the stop
  reason is checked before any block is read.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import anthropic

from app.ai.base import ChatMessage
from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

#: Floor for `max_tokens`. Thinking shares the budget with the reply, so the
#: app-wide LLM_MAX_OUTPUT_TOKENS (tuned for a non-thinking model) is too small
#: on its own and would truncate the narrative.
MIN_MAX_TOKENS = 4096

#: Appended to the system prompt when the caller wants JSON. The provider layer
#: has no schema to hand to structured outputs — callers pass a bare
#: `json_mode` flag — so the instruction plus `_unfence` below is the contract.
JSON_ONLY_SUFFIX = (
    "\n\nReturn only a single valid JSON object. No prose, no explanation, "
    "and no markdown code fences."
)

_FENCE = re.compile(r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$", re.DOTALL)


def _unfence(text: str) -> str:
    """Strip a ```json fence if the model wrapped its object in one anyway."""
    match = _FENCE.match(text)
    return match.group("body") if match else text.strip()


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, *, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        self._client: Optional[anthropic.AsyncAnthropic] = None
        if self._settings.ANTHROPIC_API_KEY:
            self._client = anthropic.AsyncAnthropic(
                api_key=self._settings.ANTHROPIC_API_KEY,
                timeout=self._settings.LLM_TIMEOUT_SECONDS,
            )

    @property
    def available(self) -> bool:
        return self._client is not None

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.close()

    async def complete(
        self,
        messages: List[ChatMessage],
        *,
        max_tokens: Optional[int] = None,
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> Optional[str]:
        if self._client is None:
            return None

        # Claude takes the system prompt as a top-level argument rather than a
        # message with role "system", so split it out of the list.
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        turns = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m.get("role") in {"user", "assistant"}
        ]
        if not turns:
            logger.warning("Anthropic provider called with no user turn.")
            return None

        system = "\n\n".join(part for part in system_parts if part)
        if json_mode:
            system = f"{system}{JSON_ONLY_SUFFIX}" if system else JSON_ONLY_SUFFIX.strip()

        request: Dict[str, Any] = {
            "model": self._settings.llm_model,
            "max_tokens": max(
                max_tokens or self._settings.LLM_MAX_OUTPUT_TOKENS, MIN_MAX_TOKENS
            ),
            "messages": turns,
            "output_config": {"effort": self._settings.LLM_EFFORT},
        }
        if system:
            request["system"] = system

        try:
            response = await self._client.messages.create(**request)
        except anthropic.AuthenticationError:
            logger.error("ANTHROPIC_API_KEY was rejected; AI features are degraded.")
            return None
        except anthropic.NotFoundError:
            logger.error("Unknown Claude model '%s'.", self._settings.llm_model)
            return None
        except anthropic.RateLimitError:
            # The SDK already retried with backoff; give up rather than block
            # the request any longer.
            logger.warning("Claude rate limit reached; falling back to rule-based output.")
            return None
        except anthropic.APIStatusError as exc:
            logger.warning("Claude returned %s: %s", exc.status_code, exc.message)
            return None
        except anthropic.APIConnectionError as exc:
            logger.warning("Could not reach the Claude API: %s", exc)
            return None

        if response.stop_reason == "refusal":
            category = getattr(response.stop_details, "category", None)
            logger.warning("Claude declined the request (category=%s).", category)
            return None

        # Thinking blocks share the content list with the reply; keep the text.
        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        ).strip()
        if not text:
            logger.warning(
                "Claude returned no text (stop_reason=%s).", response.stop_reason
            )
            return None

        if response.stop_reason == "max_tokens":
            # Truncated output is usually unparseable JSON and a half-written
            # narrative; say so rather than letting the caller guess.
            logger.warning(
                "Claude hit max_tokens (%s); raise LLM_MAX_OUTPUT_TOKENS or lower "
                "LLM_EFFORT.",
                request["max_tokens"],
            )

        return _unfence(text) if json_mode else text
