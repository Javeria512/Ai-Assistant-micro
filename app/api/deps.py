"""Shared FastAPI dependencies (auth, Graph client, service wiring)."""

from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConfigurationError
from app.core.logging import set_request_context
from app.core.security import decode_access_token
from app.db.session import get_db
from app.integrations.microsoft.graph_client import GraphClient
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.assistant_service import AssistantService
from app.services.auth_service import AuthService
from app.services.calendar_service import CalendarService
from app.services.chat_service import ChatService
from app.services.mail_service import MailService
from app.services.profile_service import ProfileService
from app.services.task_service import TaskService
from app.services.token_service import TokenService

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="Session bearer token",
    description="Application session JWT issued by /auth/microsoft/callback.",
)


def get_http_client(request: Request) -> httpx.AsyncClient:
    """The shared, connection-pooled client created during app startup."""
    client: Optional[httpx.AsyncClient] = getattr(request.app.state, "http_client", None)
    if client is None:  # pragma: no cover - only if lifespan did not run
        raise ConfigurationError("HTTP client is not initialised.")
    return client


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the caller from the session bearer token."""
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Missing bearer token.")

    claims = decode_access_token(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise AuthenticationError("Session token has no subject.")

    user = await UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("The account no longer exists or is disabled.")

    set_request_context(getattr(request.state, "request_id", "-"), user.id)
    return user


async def get_graph_client(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    http_client: httpx.AsyncClient = Depends(get_http_client),
) -> GraphClient:
    """A Graph client bound to a freshly refreshed access token."""
    access_token = await TokenService(db).get_access_token(user)
    return GraphClient(access_token, http_client)


def get_auth_service(
    db: AsyncSession = Depends(get_db),
    http_client: httpx.AsyncClient = Depends(get_http_client),
) -> AuthService:
    return AuthService(db, http_client=http_client)


def get_profile_service(
    client: GraphClient = Depends(get_graph_client),
    user: User = Depends(get_current_user),
) -> ProfileService:
    return ProfileService(client, user)


def get_mail_service(
    client: GraphClient = Depends(get_graph_client),
    user: User = Depends(get_current_user),
) -> MailService:
    return MailService(client, user)


def get_calendar_service(
    client: GraphClient = Depends(get_graph_client),
    user: User = Depends(get_current_user),
) -> CalendarService:
    return CalendarService(client, user)


def get_task_service(
    client: GraphClient = Depends(get_graph_client),
    user: User = Depends(get_current_user),
) -> TaskService:
    return TaskService(client, user)


def get_chat_service(
    client: GraphClient = Depends(get_graph_client),
    user: User = Depends(get_current_user),
) -> ChatService:
    return ChatService(client, user)


def get_assistant_service(
    client: GraphClient = Depends(get_graph_client),
    user: User = Depends(get_current_user),
    http_client: httpx.AsyncClient = Depends(get_http_client),
) -> AssistantService:
    return AssistantService(client, user, http_client=http_client)
