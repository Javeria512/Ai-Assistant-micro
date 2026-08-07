"""Chooses the LLM provider from configuration."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.ai.base import LLMProvider
from app.ai.providers.anthropic_provider import AnthropicProvider
from app.ai.providers.null_provider import NullLLMProvider
from app.ai.providers.openai_provider import OpenAIProvider
from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_NULL_PROVIDER = NullLLMProvider()

#: The Anthropic SDK owns a connection pool, so the provider is built once and
#: reused instead of per request (the OpenAI provider is cheap to construct
#: because it borrows the app's shared httpx client).
_ANTHROPIC_PROVIDER: Optional[AnthropicProvider] = None


def get_llm_provider(
    http_client: Optional[httpx.AsyncClient] = None,
    *,
    settings: Optional[Settings] = None,
) -> LLMProvider:
    """Return the configured provider, or a no-op one when AI is disabled."""
    settings = settings or get_settings()
    provider_name = (settings.LLM_PROVIDER or "none").lower()

    if provider_name in {"", "none", "off", "disabled"}:
        return _NULL_PROVIDER

    if provider_name in {"anthropic", "claude"}:
        global _ANTHROPIC_PROVIDER
        if _ANTHROPIC_PROVIDER is None:
            _ANTHROPIC_PROVIDER = AnthropicProvider(settings=settings)
        if not _ANTHROPIC_PROVIDER.available:
            logger.warning(
                "LLM_PROVIDER=%s but ANTHROPIC_API_KEY is missing.", provider_name
            )
            return _NULL_PROVIDER
        return _ANTHROPIC_PROVIDER

    if provider_name in {"openai", "azure-openai", "openai-compatible"}:
        if http_client is None:
            logger.warning("LLM_PROVIDER=%s but no HTTP client available.", provider_name)
            return _NULL_PROVIDER
        provider = OpenAIProvider(http_client, settings=settings)
        if not provider.available:
            logger.warning("LLM_PROVIDER=%s but OPENAI_API_KEY is missing.", provider_name)
            return _NULL_PROVIDER
        return provider

    logger.warning("Unknown LLM_PROVIDER '%s'; AI features stay disabled.", provider_name)
    return _NULL_PROVIDER
