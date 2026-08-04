"""Aggregates every API router.

``/auth`` stays unversioned because the callback path is registered in Azure
(``REDIRECT_URI``); everything else lives under ``/api/v1``.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import assistant, auth, calendar, chats, health, mail, tasks, users
from app.core.config import get_settings

settings = get_settings()

# Browser-facing OAuth endpoints.
auth_router = APIRouter()
auth_router.include_router(auth.router)

# Versioned JSON API.
api_router = APIRouter(prefix=settings.API_V1_PREFIX)
api_router.include_router(users.router)
api_router.include_router(mail.router)
api_router.include_router(calendar.router)
api_router.include_router(chats.router)
api_router.include_router(tasks.router)
api_router.include_router(assistant.router)

health_router = health.router

__all__ = ["auth_router", "api_router", "health_router"]
