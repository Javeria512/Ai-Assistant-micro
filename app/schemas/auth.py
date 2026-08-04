"""Authentication request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema


class LoginUrlResponse(BaseSchema):
    authorization_url: str
    state: str
    expires_in: int = Field(description="Seconds the login attempt stays valid.")


class SessionUser(BaseSchema):
    id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    user_principal_name: Optional[str] = None
    job_title: Optional[str] = None
    timezone: str = "UTC"


class TokenResponse(BaseSchema):
    """Application session credentials. Microsoft tokens stay server-side."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    expires_at: datetime
    refresh_token: str
    user: SessionUser


class RefreshTokenRequest(BaseSchema):
    refresh_token: str = Field(min_length=16)


class LogoutRequest(BaseSchema):
    refresh_token: Optional[str] = None
    all_sessions: bool = False
    forget_microsoft_account: bool = Field(
        default=False,
        description=(
            "Also drop the cached Microsoft refresh token, forcing a full "
            "interactive sign-in next time."
        ),
    )


class SessionInfo(BaseSchema):
    user: SessionUser
    session_expires_at: datetime
    microsoft_connected: bool = True
    last_login_at: Optional[datetime] = None

    account_type: str = Field(
        default="work_or_school",
        description=(
            "'personal' for consumer Microsoft accounts. Teams chats and some "
            "other Graph APIs are only available to 'work_or_school' accounts."
        ),
    )
    microsoft_scopes: List[str] = Field(
        default_factory=list, description="Scopes Microsoft actually issued."
    )
    requested_scopes: List[str] = Field(
        default_factory=list, description="Scopes this deployment asks for (GRAPH_SCOPES)."
    )
    missing_scopes: List[str] = Field(
        default_factory=list,
        description=(
            "Requested but not issued. Entra drops scopes silently when the "
            "signed-in identity cannot be granted them, so this is the first "
            "thing to check when a source returns warnings."
        ),
    )
    unavailable_features: List[str] = Field(
        default_factory=list,
        description="Human-readable list of what will not work in this session.",
    )
