"""Outlook mail schemas (normalised away from raw Graph shapes)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema, Person


class EmailMessage(BaseSchema):
    id: str
    conversation_id: Optional[str] = None
    subject: str = "(no subject)"
    clean_subject: str = ""
    preview: str = ""
    body: Optional[str] = Field(default=None, description="Plain-text body, detail view only.")

    sender: Optional[Person] = None
    to_recipients: List[Person] = Field(default_factory=list)
    cc_recipients: List[Person] = Field(default_factory=list)

    received_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None

    is_read: bool = False
    is_draft: bool = False
    has_attachments: bool = False
    importance: str = "normal"
    flag_status: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    inference_classification: Optional[str] = Field(
        default=None, description='Graph"s own focused/other signal.'
    )
    web_link: Optional[str] = None

    # Derived signals consumed by the priority engine.
    recipient_count: int = 0
    addressed_directly: bool = Field(
        default=False, description="User is on the To line rather than only CC."
    )
    is_cc_only: bool = False
    is_flagged: bool = False
    looks_automated: bool = Field(
        default=False, description="Newsletter / no-reply / notification heuristics matched."
    )
    age_hours: Optional[float] = None
