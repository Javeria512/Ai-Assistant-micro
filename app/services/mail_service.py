"""Outlook mail retrieval and processing."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Set

from app.core.config import get_settings
from app.integrations.microsoft import endpoints
from app.integrations.microsoft.mappers import map_email
from app.schemas.mail import EmailMessage
from app.services.base import GraphService
from app.utils.datetime_utils import utcnow
from app.utils.text import clean_subject

logger = logging.getLogger(__name__)
settings = get_settings()


class MailService(GraphService):
    """Reads the mailbox and derives the signals the assistant needs."""

    async def list_messages(
        self,
        *,
        limit: Optional[int] = None,
        folder: str = "inbox",
        unread_only: bool = False,
        search: Optional[str] = None,
    ) -> List[EmailMessage]:
        limit = limit or settings.MAIL_FETCH_LIMIT
        path = (
            endpoints.ME_MAIL_FOLDER_MESSAGES.format(folder_id=folder)
            if folder
            else endpoints.ME_MESSAGES
        )

        params: Dict[str, object] = {
            "$select": endpoints.MESSAGE_SELECT,
            "$top": min(limit, 100),
        }
        if search:
            # $search and $orderby are mutually exclusive in Graph.
            params["$search"] = f'"{search}"'
        else:
            params["$orderby"] = "receivedDateTime desc"
            if unread_only:
                params["$filter"] = "isRead eq false"

        payloads, warning = await self.client.try_get_collection(
            path,
            params=params,
            headers={"Prefer": endpoints.PREFER_TEXT_BODY},
            max_items=limit,
        )
        self._warn(warning)

        now = utcnow()
        messages = [
            map_email(payload, identity=self.identity, now=now) for payload in payloads
        ]
        if search and unread_only:
            messages = [message for message in messages if not message.is_read]
        return messages

    async def get_message(self, message_id: str) -> EmailMessage:
        payload = await self.client.get(
            endpoints.ME_MESSAGE.format(message_id=message_id),
            params={"$select": endpoints.MESSAGE_DETAIL_SELECT},
            headers={"Prefer": endpoints.PREFER_TEXT_BODY},
        )
        return map_email(payload, identity=self.identity, include_body=True)

    async def get_recently_sent_conversation_ids(self, *, limit: int = 60) -> Set[str]:
        """Conversations the user already replied to.

        Used to tell "needs my reply" apart from "already handled" without
        pulling whole threads.
        """
        payloads, warning = await self.client.try_get_collection(
            endpoints.ME_SENT_MESSAGES,
            params={
                "$select": "conversationId,subject,sentDateTime",
                "$orderby": "sentDateTime desc",
                "$top": min(limit, 100),
            },
            max_items=limit,
        )
        if warning:
            logger.debug("Sent-items lookup unavailable: %s", warning)
            return set()

        identifiers: Set[str] = set()
        for payload in payloads:
            conversation_id = payload.get("conversationId")
            if conversation_id:
                identifiers.add(conversation_id)
            subject = clean_subject(payload.get("subject"))
            if subject:
                identifiers.add(f"subject::{subject.lower()}")
        return identifiers

    @staticmethod
    def awaiting_reply(message: EmailMessage, replied_keys: Set[str]) -> bool:
        """True when the thread looks like it is still on the user's plate."""
        if message.is_draft or message.looks_automated:
            return False
        if message.conversation_id and message.conversation_id in replied_keys:
            return False
        subject_key = f"subject::{message.clean_subject.lower()}"
        if message.clean_subject and subject_key in replied_keys:
            return False
        return not message.is_read or message.is_flagged

    async def get_unread_count(self, folder: str = "inbox") -> int:
        payload = await self.client.get(
            f"/me/mailFolders/{folder}",
            params={"$select": "unreadItemCount,totalItemCount"},
        )
        return int(payload.get("unreadItemCount") or 0)
