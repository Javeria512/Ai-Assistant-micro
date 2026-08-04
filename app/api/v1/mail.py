"""Outlook mail endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import get_assistant_service, get_mail_service
from app.schemas.common import Collection
from app.schemas.mail import EmailMessage
from app.services.assistant_service import AssistantService
from app.services.mail_service import MailService

router = APIRouter(prefix="/mail", tags=["Mail"])


@router.get(
    "/messages",
    response_model=Collection[EmailMessage],
    summary="List mailbox messages",
)
async def list_messages(
    limit: int = Query(25, ge=1, le=100),
    folder: str = Query("inbox", description="Mail folder id or well-known name."),
    unread_only: bool = Query(False),
    search: Optional[str] = Query(None, min_length=2, max_length=120),
    service: MailService = Depends(get_mail_service),
) -> Collection[EmailMessage]:
    messages = await service.list_messages(
        limit=limit, folder=folder, unread_only=unread_only, search=search
    )
    return Collection.of(messages, service.warnings)


@router.get(
    "/important",
    response_model=Collection[EmailMessage],
    summary="Important emails",
)
async def list_important_messages(
    limit: int = Query(10, ge=1, le=50),
    service: AssistantService = Depends(get_assistant_service),
) -> Collection[EmailMessage]:
    """Emails ranked by the same signals the unified priority list uses.

    Sender authority, whether you are on the To line, urgency wording, unread
    state and age all contribute - not just Outlook's own importance flag.
    """
    messages = await service.get_important_emails(limit=limit)
    return Collection.of(messages, service.warnings)


@router.get(
    "/messages/{message_id}",
    response_model=EmailMessage,
    summary="Read one message with its body",
)
async def read_message(
    message_id: str = Path(..., min_length=1),
    service: MailService = Depends(get_mail_service),
) -> EmailMessage:
    return await service.get_message(message_id)
