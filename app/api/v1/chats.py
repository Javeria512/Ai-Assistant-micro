"""Microsoft Teams chat endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query

from app.api.deps import get_assistant_service, get_chat_service
from app.schemas.chat import ChatMessage, Conversation
from app.schemas.common import Collection
from app.services.assistant_service import AssistantService
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chats", tags=["Teams"])


@router.get("", response_model=Collection[Conversation], summary="Recent Teams chats")
async def list_chats(
    limit: int = Query(20, ge=1, le=50),
    service: ChatService = Depends(get_chat_service),
) -> Collection[Conversation]:
    conversations = await service.get_conversations(limit=limit)
    return Collection.of(conversations, service.warnings)


@router.get(
    "/important",
    response_model=Collection[Conversation],
    summary="Important conversations",
)
async def list_important_chats(
    limit: int = Query(10, ge=1, le=50),
    service: AssistantService = Depends(get_assistant_service),
) -> Collection[Conversation]:
    """Conversations ranked by @mentions, unread state, who is waiting and urgency."""
    conversations = await service.get_important_conversations(limit=limit)
    return Collection.of(conversations, service.warnings)


@router.get(
    "/{chat_id}/messages",
    response_model=Collection[ChatMessage],
    summary="Messages in a chat",
)
async def list_chat_messages(
    chat_id: str = Path(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    service: ChatService = Depends(get_chat_service),
) -> Collection[ChatMessage]:
    messages = await service.get_messages(chat_id, limit=limit)
    return Collection.of(messages, service.warnings)
