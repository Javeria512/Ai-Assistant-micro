"""Microsoft access-token lifecycle.

Every Graph call goes through :func:`get_access_token`. It hides three things
from the rest of the app:

1. loading and re-saving the encrypted MSAL cache;
2. silent refresh via the cached refresh token;
3. an in-process TTL cache, because building an MSAL client performs OIDC
   discovery over the network - doing that on every request would be wasteful.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ReauthRequiredError
from app.integrations.microsoft.msal_client import (
    MicrosoftIdentityClient,
    get_identity_client,
    sanitize_scopes,
)
from app.models.user import User
from app.repositories.ms_token_repository import MsTokenRepository
from app.utils.datetime_utils import utcnow

logger = logging.getLogger(__name__)

# Refresh a little before real expiry so an in-flight request never races it.
EXPIRY_SKEW = timedelta(seconds=120)


@dataclass
class CachedAccessToken:
    access_token: str
    expires_at: datetime
    scopes: List[str]

    def is_valid(self) -> bool:
        return utcnow() + EXPIRY_SKEW < self.expires_at


class _TokenMemoryCache:
    """Process-local access-token cache with per-user locking."""

    def __init__(self) -> None:
        self._entries: Dict[str, CachedAccessToken] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def get(self, user_id: str) -> Optional[CachedAccessToken]:
        entry = self._entries.get(user_id)
        if entry and entry.is_valid():
            return entry
        if entry:
            self._entries.pop(user_id, None)
        return None

    def put(self, user_id: str, entry: CachedAccessToken) -> None:
        self._entries[user_id] = entry

    def invalidate(self, user_id: str) -> None:
        self._entries.pop(user_id, None)
        self._locks.pop(user_id, None)

    def lock(self, user_id: str) -> asyncio.Lock:
        if user_id not in self._locks:
            self._locks[user_id] = asyncio.Lock()
        return self._locks[user_id]


_memory_cache = _TokenMemoryCache()


class TokenService:
    def __init__(
        self,
        session: AsyncSession,
        identity_client: Optional[MicrosoftIdentityClient] = None,
    ) -> None:
        self._session = session
        self._identity = identity_client or get_identity_client()
        self._tokens = MsTokenRepository(session)

    def _scopes_for(self, user: User) -> List[str]:
        """Ask for exactly what the user consented to, falling back to config."""
        granted = sanitize_scopes(list(user.granted_scopes or []))
        return granted or self._identity.default_scopes

    async def get_access_token(self, user: User, *, force_refresh: bool = False) -> str:
        """Return a valid Graph access token, refreshing transparently."""
        if not force_refresh:
            cached = _memory_cache.get(user.id)
            if cached is not None:
                return cached.access_token

        async with _memory_cache.lock(user.id):
            # Another coroutine may have refreshed while we waited for the lock.
            if not force_refresh:
                cached = _memory_cache.get(user.id)
                if cached is not None:
                    return cached.access_token

            serialized_cache = await self._tokens.get_cache(user.id)
            if not serialized_cache:
                raise ReauthRequiredError(
                    "No Microsoft credentials stored for this account. Please sign in again."
                )

            result, updated_cache = await self._identity.acquire_token_silent(
                serialized_cache,
                home_account_id=user.ms_home_account_id,
                scopes=self._scopes_for(user),
                force_refresh=force_refresh,
            )

            if updated_cache:
                await self._tokens.save_cache(
                    user.id,
                    updated_cache,
                    scopes=result.scopes or None,
                    expires_in=result.expires_in,
                )
                # Persist immediately: losing a rotated refresh token would log
                # the user out on the next request.
                await self._session.commit()

            if result.scopes and list(user.granted_scopes or []) != result.scopes:
                user.granted_scopes = result.scopes
                await self._session.flush()

            entry = CachedAccessToken(
                access_token=result.access_token,
                expires_at=utcnow() + timedelta(seconds=result.expires_in),
                scopes=result.scopes,
            )
            _memory_cache.put(user.id, entry)
            logger.debug("Acquired Graph token for user %s (%ss)", user.id, result.expires_in)
            return entry.access_token

    async def store_initial_cache(
        self, user: User, serialized_cache: Optional[str], *, scopes: List[str], expires_in: int
    ) -> None:
        """Persist the cache produced by the interactive sign-in."""
        if not serialized_cache:
            logger.warning("MSAL returned no cache to persist for user %s", user.id)
            return
        await self._tokens.save_cache(
            user.id, serialized_cache, scopes=scopes, expires_in=expires_in
        )
        _memory_cache.invalidate(user.id)

    async def forget_microsoft_account(self, user: User) -> None:
        """Drop the cached refresh token; next Graph call requires a new sign-in."""
        serialized_cache = await self._tokens.get_cache(user.id)
        if serialized_cache:
            updated = await self._identity.forget_account(
                serialized_cache, home_account_id=user.ms_home_account_id
            )
            if updated:
                await self._tokens.save_cache(user.id, updated)
        await self._tokens.delete_cache(user.id)
        _memory_cache.invalidate(user.id)

    @staticmethod
    def invalidate_cached_token(user_id: str) -> None:
        _memory_cache.invalidate(user_id)
