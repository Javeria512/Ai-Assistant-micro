"""Persistence for the encrypted MSAL token cache."""

from __future__ import annotations

from datetime import timedelta
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_text, encrypt_text
from app.models.ms_token import MsTokenCache
from app.utils.datetime_utils import utcnow


class MsTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _get_row(self, user_id: str) -> Optional[MsTokenCache]:
        result = await self._session.execute(
            select(MsTokenCache).where(MsTokenCache.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_cache(self, user_id: str) -> Optional[str]:
        """Return the decrypted MSAL cache, or ``None`` when absent/unreadable."""
        row = await self._get_row(user_id)
        if row is None:
            return None
        return decrypt_text(row.encrypted_cache)

    async def get_scopes(self, user_id: str) -> List[str]:
        row = await self._get_row(user_id)
        return list(row.scopes or []) if row else []

    async def save_cache(
        self,
        user_id: str,
        serialized_cache: str,
        *,
        scopes: Optional[List[str]] = None,
        expires_in: Optional[int] = None,
    ) -> MsTokenCache:
        row = await self._get_row(user_id)
        if row is None:
            row = MsTokenCache(user_id=user_id, encrypted_cache="", scopes=[])
            self._session.add(row)

        row.encrypted_cache = encrypt_text(serialized_cache)
        row.last_refreshed_at = utcnow()
        if scopes:
            row.scopes = scopes
        if expires_in:
            row.access_token_expires_at = utcnow() + timedelta(seconds=int(expires_in))

        await self._session.flush()
        return row

    async def delete_cache(self, user_id: str) -> None:
        await self._session.execute(
            delete(MsTokenCache).where(MsTokenCache.user_id == user_id)
        )
