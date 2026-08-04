"""Microsoft Teams chats and messages."""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from app.core.config import get_settings
from app.core.exceptions import ReauthRequiredError
from app.integrations.microsoft import endpoints
from app.integrations.microsoft.mappers import map_chat_message, map_conversation
from app.schemas.chat import ChatMessage, Conversation
from app.services.base import GraphService
from app.utils.datetime_utils import utcnow

logger = logging.getLogger(__name__)
settings = get_settings()

# Fetching messages per chat costs one request each; only enrich the top chats.
MAX_ENRICHED_CHATS = 8


class ChatService(GraphService):
    def _unsupported_reason(self) -> Optional[str]:
        """Why Teams cannot work for this account, checked before calling Graph.

        Both cases return a bare 401 from Graph, which is indistinguishable from
        an expired token, so they are detected up front instead.
        """
        if self.user.is_personal_account:
            return (
                "Teams chats need a Microsoft work or school account. This session "
                "is signed in with a personal Microsoft account, for which Graph "
                "does not expose /me/chats."
            )
        if self.user.granted_scopes and not self.user.has_scope("Chat.Read"):
            return (
                "Teams chats are unavailable: Microsoft did not issue the Chat.Read "
                "scope for this account. Add it in Azure, then sign in again with "
                "/auth/login?prompt=consent."
            )
        return None

    async def get_conversations(
        self, *, limit: Optional[int] = None, enrich: bool = True
    ) -> List[Conversation]:
        """Recent chats with unread / waiting-on-me signals resolved."""
        limit = limit or settings.CHAT_FETCH_LIMIT

        unsupported = self._unsupported_reason()
        if unsupported:
            self._warn(unsupported)
            return []

        try:
            payloads, warning = await self.client.try_get_collection(
                endpoints.ME_CHATS,
                params={
                    "$expand": "members,lastMessagePreview",
                    "$orderby": "lastMessagePreview/createdDateTime desc",
                    "$top": min(limit, 50),
                },
                max_items=limit,
            )
        except ReauthRequiredError:
            # Graph answers 401 for identities the chats API does not serve. The
            # token itself is fine - other endpoints in this same request work -
            # so degrade instead of forcing a pointless re-login.
            self._warn(
                "Microsoft rejected the Teams chats request for this account. "
                "The chats API requires a work or school account with a Teams licence."
            )
            return []

        if warning:
            self._warn(
                "Teams chats are unavailable. Confirm the Chat.Read delegated "
                "permission has been granted."
            )
            return []

        now = utcnow()
        conversations = [
            map_conversation(payload, identity=self.identity, now=now)
            for payload in payloads
        ]
        conversations = [
            conversation for conversation in conversations if conversation.last_activity_at
        ]
        conversations.sort(key=lambda item: item.last_activity_at, reverse=True)

        if enrich:
            await self._enrich_with_mentions(conversations[:MAX_ENRICHED_CHATS])
        return conversations

    async def _enrich_with_mentions(self, conversations: List[Conversation]) -> None:
        """Detect @mentions of the user in each chat's recent messages."""
        if not conversations:
            return

        async def enrich(conversation: Conversation) -> None:
            messages = await self.get_messages(
                conversation.id, limit=settings.CHAT_MESSAGE_FETCH_LIMIT, quiet=True
            )
            if not messages:
                return
            conversation.recent_message_count = len(messages)
            conversation.mentions_me = any(message.mentions_me for message in messages)

        results = await asyncio.gather(
            *(enrich(conversation) for conversation in conversations),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, BaseException):
                logger.debug("Chat enrichment failed: %s", result)

    async def get_messages(
        self, chat_id: str, *, limit: Optional[int] = None, quiet: bool = False
    ) -> List[ChatMessage]:
        limit = limit or settings.CHAT_MESSAGE_FETCH_LIMIT

        unsupported = self._unsupported_reason()
        if unsupported:
            if not quiet:
                self._warn(unsupported)
            return []

        try:
            payloads, warning = await self.client.try_get_collection(
                endpoints.ME_CHAT_MESSAGES.format(chat_id=chat_id),
                params={"$top": min(limit, 50)},
                max_items=limit,
            )
        except ReauthRequiredError:
            if not quiet:
                self._warn(
                    "Microsoft rejected the Teams messages request for this account."
                )
            return []

        if warning and not quiet:
            self._warn(warning)

        messages = [
            map_chat_message(payload, identity=self.identity, chat_id=chat_id)
            for payload in payloads
        ]
        # System join/leave events are not conversation content.
        messages = [
            message
            for message in messages
            if message.message_type == "message" and message.content
        ]
        messages.sort(key=lambda item: (item.created_at is None, item.created_at), reverse=True)
        return messages

    @staticmethod
    def needs_attention(conversation: Conversation) -> bool:
        """Cheap pre-filter before full priority scoring."""
        return (
            conversation.waiting_on_me
            or conversation.mentions_me
            or (conversation.is_unread and conversation.chat_type == "oneOnOne")
        )
