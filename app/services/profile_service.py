"""User profile, photo and mailbox preferences from Microsoft Graph."""

from __future__ import annotations

import base64
import logging
from typing import Optional, Tuple

from app.core.exceptions import AppError
from app.integrations.microsoft import endpoints
from app.integrations.microsoft.mappers import map_mailbox_settings, map_user_profile
from app.schemas.user import MailboxPreferences, UserProfile
from app.services.base import GraphService
from app.utils.datetime_utils import to_iana_name

logger = logging.getLogger(__name__)


class ProfileService(GraphService):
    async def get_profile(self) -> UserProfile:
        payload = await self.client.get(
            endpoints.ME, params={"$select": endpoints.USER_SELECT}
        )
        return map_user_profile(
            payload,
            user_id=self.user.id,
            timezone=self.timezone,
            last_login_at=self.user.last_login_at,
        )

    async def get_photo(self) -> Optional[Tuple[bytes, str]]:
        """Return ``(bytes, content_type)`` or ``None`` when no photo is set."""
        try:
            content = await self.client.get_bytes(endpoints.ME_PHOTO)
        except AppError as exc:
            logger.info("Profile photo unavailable: %s", exc.message)
            return None
        if not content:
            return None
        return content, "image/jpeg"

    async def get_photo_data_uri(self) -> Optional[str]:
        """Convenience for clients that prefer an inline image."""
        photo = await self.get_photo()
        if photo is None:
            return None
        content, content_type = photo
        encoded = base64.b64encode(content).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    async def get_mailbox_preferences(self) -> MailboxPreferences:
        try:
            payload = await self.client.get(endpoints.ME_MAILBOX_SETTINGS)
        except AppError as exc:
            self._warn(f"mailboxSettings: {exc.message}")
            return MailboxPreferences(timezone=self.timezone)
        return map_mailbox_settings(payload)

    async def resolve_timezone(self) -> str:
        """Mailbox timezone, normalised to IANA, falling back to the stored one."""
        preferences = await self.get_mailbox_preferences()
        return to_iana_name(preferences.timezone, default=self.timezone)
