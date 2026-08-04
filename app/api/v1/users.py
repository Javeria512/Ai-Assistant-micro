"""User profile endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_profile_service
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    MailboxPreferences,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfile,
)
from app.services.profile_service import ProfileService
from app.utils.datetime_utils import to_iana_name

router = APIRouter(prefix="/users", tags=["User"])


@router.get("/me", response_model=UserProfile, summary="Signed-in user profile")
async def read_me(service: ProfileService = Depends(get_profile_service)) -> UserProfile:
    return await service.get_profile()


@router.get(
    "/me/photo",
    summary="Profile photo",
    response_class=Response,
    responses={
        200: {"content": {"image/jpeg": {}}, "description": "The user's photo."},
        204: {"description": "No photo is set for this account."},
    },
)
async def read_my_photo(service: ProfileService = Depends(get_profile_service)) -> Response:
    photo = await service.get_photo()
    if photo is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    content, content_type = photo
    return Response(
        content=content,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get(
    "/me/mailbox",
    response_model=MailboxPreferences,
    summary="Mailbox settings (timezone, working hours)",
)
async def read_mailbox_settings(
    service: ProfileService = Depends(get_profile_service),
) -> MailboxPreferences:
    return await service.get_mailbox_preferences()


@router.get(
    "/me/preferences",
    response_model=UserPreferences,
    summary="Assistant personalisation",
)
async def read_preferences(user: User = Depends(get_current_user)) -> UserPreferences:
    return UserPreferences(
        timezone=user.timezone or "UTC",
        vip_contacts=list(user.vip_contacts or []),
        priority_weights=dict(user.priority_weights or {}),
    )


@router.patch(
    "/me/preferences",
    response_model=UserPreferences,
    summary="Update assistant personalisation",
)
async def update_preferences(
    payload: UserPreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    """Tune VIP contacts, timezone and priority weights for this user."""
    updated = await UserRepository(db).update_preferences(
        user,
        timezone=to_iana_name(payload.timezone) if payload.timezone else None,
        vip_contacts=payload.vip_contacts,
        priority_weights=payload.priority_weights,
    )
    return UserPreferences(
        timezone=updated.timezone or "UTC",
        vip_contacts=list(updated.vip_contacts or []),
        priority_weights=dict(updated.priority_weights or {}),
    )
