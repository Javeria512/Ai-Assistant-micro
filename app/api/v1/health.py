"""Liveness and readiness probes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.common import HealthStatus

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health", response_model=HealthStatus, summary="Liveness probe")
async def health() -> HealthStatus:
    return HealthStatus(
        status="ok",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get("/health/ready", response_model=HealthStatus, summary="Readiness probe")
async def readiness(db: AsyncSession = Depends(get_db)) -> HealthStatus:
    """Verifies the database is reachable before the pod takes traffic."""
    try:
        await db.execute(text("SELECT 1"))
        database = "ok"
        status = "ok"
    except Exception:  # noqa: BLE001 - readiness must report, not raise
        database = "unavailable"
        status = "degraded"

    return HealthStatus(
        status=status,
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        database=database,
    )
