"""Async SQLAlchemy engine, session factory and FastAPI dependency."""

from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.db.base import Base

logger = logging.getLogger(__name__)

settings = get_settings()
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

_engine_kwargs: Dict[str, Any] = {"echo": settings.DB_ECHO, "future": True}
if _is_sqlite:
    # aiosqlite runs in a worker thread; the connection must be shareable.
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs.update(
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_pre_ping=True,
    )

engine: AsyncEngine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

SessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Request-scoped session. Commits on success, rolls back on failure."""
    async with SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create tables that do not exist yet.

    Convenient for local development. For production use Alembic migrations
    (``alembic revision --autogenerate``) instead of relying on this.
    """
    # Import models so they are registered on Base.metadata before create_all.
    from app import models  # noqa: F401  (side-effect import)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema verified (%s)", engine.url.render_as_string(hide_password=True))


async def dispose_db() -> None:
    await engine.dispose()
