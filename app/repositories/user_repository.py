"""Persistence for application users."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.datetime_utils import utcnow


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: str) -> Optional[User]:
        return await self._session.get(User, user_id)

    async def get_by_ms_object_id(self, ms_object_id: str) -> Optional[User]:
        result = await self._session.execute(
            select(User).where(User.ms_object_id == ms_object_id)
        )
        return result.scalar_one_or_none()

    async def upsert_from_login(
        self,
        *,
        ms_object_id: str,
        ms_tenant_id: Optional[str],
        ms_home_account_id: Optional[str],
        user_principal_name: Optional[str],
        email: Optional[str],
        display_name: Optional[str],
        granted_scopes: Optional[List[str]] = None,
    ) -> User:
        """Create the user on first sign-in, refresh the snapshot afterwards."""
        user = await self.get_by_ms_object_id(ms_object_id)
        if user is None:
            user = User(ms_object_id=ms_object_id, vip_contacts=[], priority_weights={})
            self._session.add(user)

        user.ms_tenant_id = ms_tenant_id or user.ms_tenant_id
        user.ms_home_account_id = ms_home_account_id or user.ms_home_account_id
        user.user_principal_name = user_principal_name or user.user_principal_name
        user.email = email or user.email
        user.display_name = display_name or user.display_name
        user.last_login_at = utcnow()
        user.is_active = True
        if granted_scopes:
            user.granted_scopes = granted_scopes

        await self._session.flush()
        return user

    async def apply_graph_profile(self, user: User, profile: Dict[str, Any]) -> User:
        """Refresh the cached profile snapshot from ``/me``."""
        user.display_name = profile.get("displayName") or user.display_name
        user.given_name = profile.get("givenName") or user.given_name
        user.job_title = profile.get("jobTitle") or user.job_title
        user.department = profile.get("department") or user.department
        user.office_location = profile.get("officeLocation") or user.office_location
        user.preferred_language = profile.get("preferredLanguage") or user.preferred_language
        user.email = (profile.get("mail") or user.email or "").lower() or None
        user.user_principal_name = (
            profile.get("userPrincipalName") or user.user_principal_name
        )
        await self._session.flush()
        return user

    async def update_preferences(
        self,
        user: User,
        *,
        timezone: Optional[str] = None,
        vip_contacts: Optional[List[str]] = None,
        priority_weights: Optional[Dict[str, Any]] = None,
    ) -> User:
        if timezone is not None:
            user.timezone = timezone
        if vip_contacts is not None:
            user.vip_contacts = [item.strip().lower() for item in vip_contacts if item.strip()]
        if priority_weights is not None:
            user.priority_weights = priority_weights
        await self._session.flush()
        return user

    async def set_timezone(self, user: User, timezone: str) -> None:
        if timezone and timezone != user.timezone:
            user.timezone = timezone
            await self._session.flush()
