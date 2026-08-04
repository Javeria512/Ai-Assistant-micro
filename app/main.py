"""FastAPI application factory and entrypoint.

Run with:
    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.router import api_router, auth_router, health_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, set_request_context
from app.db.session import dispose_db, init_db
from app.integrations.microsoft.graph_client import create_http_client

settings = get_settings()
logger = logging.getLogger(__name__)

DESCRIPTION = """
Backend for the **AI Executive Personal Assistant**.

Signs the user in with Microsoft OAuth 2.0 (MSAL, authorization-code + PKCE),
reads Outlook, Calendar, Teams and Tasks through Microsoft Graph, and merges
everything into one explainable, ranked worklist.

* `/auth/*` - sign-in, session refresh, sign-out
* `/api/v1/users`, `/mail`, `/calendar`, `/chats`, `/tasks` - per-source data
* `/api/v1/assistant/*` - daily brief, user summary, Single Unified Priority list
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Own the resources whose lifetime matches the process."""
    configure_logging(settings.LOG_LEVEL, settings.LOG_JSON)
    logger.info(
        "Starting %s v%s (env=%s)",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )

    await init_db()
    app.state.http_client = create_http_client(settings)

    try:
        yield
    finally:
        await app.state.http_client.aclose()
        await dispose_db()
        logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    application.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID"],
        )

    @application.middleware("http")
    async def request_context(request: Request, call_next):
        """Attach a correlation id and log slow requests."""
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        set_request_context(request_id)

        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-ms"] = f"{elapsed_ms:.1f}"
        if elapsed_ms > 3000:
            logger.warning(
                "Slow request %s %s took %.0fms", request.method, request.url.path, elapsed_ms
            )
        return response

    register_exception_handlers(application)

    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(api_router)

    @application.get("/", tags=["Health"], summary="Service banner")
    async def root() -> Dict[str, Any]:
        return {
            "message": "AI Assistant Backend Running",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "docs": "/docs",
            "login": "/auth/login",
            "api": settings.API_V1_PREFIX,
        }

    return application


app = create_app()
