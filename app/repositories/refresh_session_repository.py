"""Persistence for application refresh sessions (rotating refresh tokens)."""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_token
from app.models.session import RefreshSession
from app.utils.datetime_utils import ensure_aware, utcnow


class RefreshSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: str,
        raw_token: str,
        ttl_days: int,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> RefreshSession:
        row = RefreshSession(
            user_id=user_id,
            token_hash=hash_token(raw_token),
            expires_at=utcnow() + timedelta(days=ttl_days),
            user_agent=(user_agent or "")[:512] or None,
            ip_address=(ip_address or "")[:64] or None,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_active(self, raw_token: str) -> Optional[RefreshSession]:
        result = await self._session.execute(
            select(RefreshSession).where(RefreshSession.token_hash == hash_token(raw_token))
        )
        row = result.scalar_one_or_none()
        if row is None or row.revoked_at is not None:
            return None
        if ensure_aware(row.expires_at) < utcnow():
            return None
        return row

    async def rotate(
        self,
        current: RefreshSession,
        *,
        raw_token: str,
        ttl_days: int,
    ) -> RefreshSession:
        """Issue a successor token and revoke the presented one."""
        replacement = RefreshSession(
            user_id=current.user_id,
            token_hash=hash_token(raw_token),
            expires_at=utcnow() + timedelta(days=ttl_days),
            user_agent=current.user_agent,
            ip_address=current.ip_address,
        )
        self._session.add(replacement)
        await self._session.flush()

        current.revoked_at = utcnow()
        current.rotated_to = replacement.id
        await self._session.flush()
        return replacement

    async def revoke(self, row: RefreshSession) -> None:
        row.revoked_at = utcnow()
        await self._session.flush()

    async def revoke_all_for_user(self, user_id: str) -> int:
        result = await self._session.execute(
            update(RefreshSession)
            .where(RefreshSession.user_id == user_id, RefreshSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
        return result.rowcount or 0

    async def purge_expired(self, *, keep_days: int = 7) -> int:
        cutoff = utcnow() - timedelta(days=keep_days)
        result = await self._session.execute(
            delete(RefreshSession).where(RefreshSession.expires_at < cutoff)
        )
        return result.rowcount or 0
