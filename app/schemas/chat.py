"""Microsoft Teams chat schemas."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema


class ChatParticipant(BaseSchema):
    id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None


class ChatMessage(BaseSchema):
    id: str
    chat_id: Optional[str] = None
    created_at: Optional[datetime] = None
    author: Optional[ChatParticipant] = None
    content: str = ""
    importance: str = "normal"
    message_type: str = "message"
    from_me: bool = False
    mentions_me: bool = False
    has_attachments: bool = False
    web_url: Optional[str] = None


class Conversation(BaseSchema):
    """A Teams chat plus the derived "does this need me?" signals."""

    id: str
    topic: Optional[str] = None
    chat_type: str = "oneOnOne"
    web_url: Optional[str] = None

    created_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    last_read_at: Optional[datetime] = None

    last_message_preview: str = ""
    last_message_from: Optional[ChatParticipant] = None
    last_message_from_me: bool = False

    participants: List[ChatParticipant] = Field(default_factory=list)
    participant_count: int = 0

    is_unread: bool = False
    mentions_me: bool = False
    waiting_on_me: bool = Field(
        default=False,
        description="Last message came from someone else and is still unread.",
    )
    recent_message_count: int = 0
    age_hours: Optional[float] = None
    display_name: str = Field(default="", description="Best label for the chat in a UI.")
