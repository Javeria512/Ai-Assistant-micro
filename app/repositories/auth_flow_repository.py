"""Persistence for in-flight OAuth authorization-code flows."""

from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Any, Dict, Optional

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_text, encrypt_text
from app.models.auth_flow import AuthFlowState
from app.utils.datetime_utils import ensure_aware, utcnow

logger = logging.getLogger(__name__)


class AuthFlowRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(
        self,
        flow: Dict[str, Any],
        *,
        ttl_seconds: int,
        redirect_after: Optional[str] = None,
    ) -> AuthFlowState:
        """Store the MSAL flow dict keyed by its ``state``."""
        state = flow.get("state")
        if not state:
            raise ValueError("MSAL flow is missing a state value.")

        row = AuthFlowState(
            state=state,
            encrypted_flow=encrypt_text(json.dumps(flow)),
            expires_at=utcnow() + timedelta(seconds=ttl_seconds),
            redirect_after=redirect_after,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def consume(self, state: str) -> Optional[AuthFlowState]:
        """Fetch and mark a flow as used. Returns ``None`` if invalid/expired/reused."""
        row = await self._session.get(AuthFlowState, state)
        if row is None:
            logger.warning("OAuth callback used an unknown state value.")
            return None
        if row.consumed_at is not None:
            logger.warning("OAuth callback replayed an already-consumed state value.")
            return None
        if ensure_aware(row.expires_at) < utcnow():
            logger.warning("OAuth callback used an expired state value.")
            return None

        row.consumed_at = utcnow()
        await self._session.flush()
        return row

    @staticmethod
    def decode_flow(row: AuthFlowState) -> Optional[Dict[str, Any]]:
        payload = decrypt_text(row.encrypted_flow)
        if payload is None:
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            logger.warning("Stored OAuth flow payload is not valid JSON.")
            return None

    async def purge_expired(self) -> int:
        """Housekeeping: drop flows that can no longer be used."""
        cutoff = utcnow() - timedelta(hours=1)
        result = await self._session.execute(
            delete(AuthFlowState).where(AuthFlowState.expires_at < cutoff)
        )
        return result.rowcount or 0
