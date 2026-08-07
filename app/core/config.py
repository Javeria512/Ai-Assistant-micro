"""Central application configuration.

All settings are read from environment variables (or the project ``.env`` file).
The Microsoft variable names match the reference implementation exactly
(``CLIENT_ID``, ``CLIENT_SECRET``, ``TENANT_ID``, ``REDIRECT_URI``) so the
existing Azure app registration keeps working without changes.
"""

from __future__ import annotations

import base64
import hashlib
import logging
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]

# Delegated Microsoft Graph permissions the assistant needs.
# NOTE: never include the OIDC scopes (openid/profile/offline_access) here --
# MSAL injects them and raises if they are passed explicitly.
DEFAULT_GRAPH_SCOPES = (
    "User.Read "
    "Mail.Read "
    "Calendars.Read "
    "Tasks.ReadWrite "
    "Chat.Read "
    "People.Read "
    "MailboxSettings.Read"
)


def _derive_secret(seed: str, purpose: str) -> str:
    """Deterministically derive a hex secret from an existing secret."""
    return hashlib.sha256(f"{purpose}:{seed}".encode("utf-8")).hexdigest()


def _derive_fernet_key(seed: str, purpose: str) -> str:
    """Deterministically derive a valid 32-byte url-safe base64 Fernet key."""
    digest = hashlib.sha256(f"{purpose}:{seed}".encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def _split_csv(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


class Settings(BaseSettings):
    """Typed, validated application settings."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ------------------------------------------------------------------ app
    APP_NAME: str = "AI Executive Assistant API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # ------------------------------------------- Microsoft Entra ID / Graph
    CLIENT_ID: str
    CLIENT_SECRET: str
    TENANT_ID: Optional[str] = None
    REDIRECT_URI: str = "http://localhost:8000/auth/microsoft/callback"
    AUTHORITY_HOST: str = "https://login.microsoftonline.com"
    # "common" preserves the multi-tenant sign-in behaviour of the reference code.
    # Set AUTHORITY_TENANT=tenant to lock sign-in to your own tenant only.
    AUTHORITY_TENANT: str = "common"
    GRAPH_BASE_URL: str = "https://graph.microsoft.com/v1.0"
    GRAPH_SCOPES: str = DEFAULT_GRAPH_SCOPES
    AUTH_FLOW_TTL_SECONDS: int = 600
    # "query" keeps the GET callback of the reference implementation.
    # "form_post" is the more secure option (RFC 9700): the authorization code
    # arrives in a POST body instead of the URL. Both callbacks are registered.
    AUTH_RESPONSE_MODE: str = "query"

    # -------------------------------------------------------------- security
    SECRET_KEY: Optional[str] = None
    TOKEN_ENCRYPTION_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "ai-executive-assistant"
    JWT_AUDIENCE: str = "ai-executive-assistant-client"
    ACCESS_TOKEN_TTL_MINUTES: int = 60
    REFRESH_TOKEN_TTL_DAYS: int = 30

    # -------------------------------------------------------------- database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{(BASE_DIR / 'ai_assistant.db').as_posix()}"
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # --------------------------------------------------------------- clients
    # Where to bounce the browser after a successful login. Use an https URL for
    # web, or a deep link such as "aiassistant://auth" for React Native.
    # Leave empty to receive the session tokens as JSON (handy while testing).
    FRONTEND_REDIRECT_URI: Optional[str] = None
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:8081"

    # ------------------------------------------------------------ http/graph
    HTTP_TIMEOUT_SECONDS: float = 30.0
    HTTP_MAX_RETRIES: int = 3
    HTTP_MAX_CONNECTIONS: int = 50

    # -------------------------------------------------------- fetch windows
    MAIL_FETCH_LIMIT: int = 50
    CALENDAR_LOOKAHEAD_DAYS: int = 7
    CHAT_FETCH_LIMIT: int = 20
    CHAT_MESSAGE_FETCH_LIMIT: int = 15
    TASK_FETCH_LIMIT: int = 100
    PRIORITY_MAX_ITEMS: int = 30

    # ---------------------------------------------------------- personalisation
    # Comma separated addresses or domains treated as high-authority senders,
    # e.g. "ceo@acme.com,board@acme.com". Per-user overrides live in the DB.
    VIP_CONTACTS: str = ""

    # -------------------------------------------------------------------- AI
    # "none" keeps the deterministic rule-based output. Set to "anthropic" or
    # "openai" (and provide the matching key) to enable LLM summaries and
    # reranking without code changes.
    LLM_PROVIDER: str = "none"
    # Left empty so each provider can supply its own default; read
    # `llm_model` rather than this field.
    LLM_MODEL: str = ""
    LLM_TIMEOUT_SECONDS: float = 45.0
    LLM_MAX_OUTPUT_TOKENS: int = 900
    # Thinking depth / token spend for Claude: low | medium | high | xhigh | max.
    # The brief and the reranker are short, latency-sensitive calls, and Claude
    # models are strong at "low" — raise this if the narrative needs more depth.
    LLM_EFFORT: str = "low"
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # ------------------------------------------------------------ properties
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod", "staging"}

    @property
    def authority(self) -> str:
        """Authority used for interactive sign-in and token acquisition."""
        return f"{self.AUTHORITY_HOST.rstrip('/')}/{self.AUTHORITY_TENANT}"

    @property
    def admin_consent_authority(self) -> str:
        """Admin consent must target a concrete tenant when one is configured."""
        tenant = self.TENANT_ID or self.AUTHORITY_TENANT
        return f"{self.AUTHORITY_HOST.rstrip('/')}/{tenant}"

    @property
    def graph_scopes(self) -> List[str]:
        return [scope for scope in self.GRAPH_SCOPES.replace(",", " ").split() if scope]

    @property
    def cors_origins(self) -> List[str]:
        return _split_csv(self.CORS_ORIGINS)

    @property
    def vip_contacts(self) -> List[str]:
        return [item.lower() for item in _split_csv(self.VIP_CONTACTS)]

    @property
    def llm_model(self) -> str:
        """Configured model, or the active provider's default when unset."""
        if self.LLM_MODEL:
            return self.LLM_MODEL
        provider = (self.LLM_PROVIDER or "none").lower()
        if provider.startswith("anthropic") or provider == "claude":
            return "claude-opus-5"
        return "gpt-4o-mini"

    @property
    def callback_path(self) -> str:
        """Path portion of REDIRECT_URI, so routing always matches Azure."""
        from urllib.parse import urlparse

        path = urlparse(self.REDIRECT_URI).path or "/auth/microsoft/callback"
        return path

    # ------------------------------------------------------------ validation
    @model_validator(mode="after")
    def _fill_derived_secrets(self) -> "Settings":
        if not self.SECRET_KEY:
            if self.is_production:
                raise ValueError(
                    "SECRET_KEY must be set explicitly when ENVIRONMENT is production."
                )
            self.SECRET_KEY = _derive_secret(self.CLIENT_SECRET, "session-signing")
            logger.warning(
                "SECRET_KEY is not set; derived a development key from CLIENT_SECRET. "
                "Set SECRET_KEY before deploying."
            )

        if not self.TOKEN_ENCRYPTION_KEY:
            if self.is_production:
                raise ValueError(
                    "TOKEN_ENCRYPTION_KEY must be set explicitly when ENVIRONMENT is production."
                )
            self.TOKEN_ENCRYPTION_KEY = _derive_fernet_key(self.CLIENT_SECRET, "token-cache")
            logger.warning(
                "TOKEN_ENCRYPTION_KEY is not set; derived a development key from "
                "CLIENT_SECRET. Set TOKEN_ENCRYPTION_KEY before deploying."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor used across the application."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
