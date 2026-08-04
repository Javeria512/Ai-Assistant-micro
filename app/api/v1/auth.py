"""Microsoft OAuth 2.0 sign-in, session refresh and sign-out.

Mounted at ``/auth`` so the callback path stays exactly the one registered in
Azure (``REDIRECT_URI``), matching the reference implementation.
"""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import parse_qsl, urlencode

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import RedirectResponse

from app.api.deps import get_auth_service, get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.schemas.auth import (
    LoginUrlResponse,
    LogoutRequest,
    RefreshTokenRequest,
    SessionInfo,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _client_meta(request: Request):
    return (
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )


@router.get(
    "/login",
    summary="Start Microsoft sign-in",
    response_model=None,
    responses={
        200: {"model": LoginUrlResponse, "description": "Returned when response=json."},
        307: {"description": "Redirect to the Microsoft sign-in page."},
    },
)
async def login(
    response: str = Query(
        "redirect",
        pattern="^(redirect|json)$",
        description="'redirect' sends the browser to Microsoft; 'json' returns the URL.",
    ),
    redirect_uri: Optional[str] = Query(
        None,
        description="Where to send the user after login. Must match an allowed origin.",
    ),
    login_hint: Optional[str] = Query(None, description="Pre-fill the sign-in box."),
    prompt: Optional[str] = Query(
        None, pattern="^(login|none|consent|select_account)$"
    ),
    service: AuthService = Depends(get_auth_service),
):
    """Build the authorization URL (PKCE + state) and remember the flow."""
    result = await service.start_login(
        redirect_after=redirect_uri, login_hint=login_hint, prompt=prompt
    )
    if response == "json":
        return result
    return RedirectResponse(result.authorization_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get(
    "/microsoft/callback",
    summary="Microsoft OAuth callback",
    response_model=None,
    responses={
        200: {"model": TokenResponse, "description": "Session tokens (no frontend configured)."},
        307: {"description": "Redirect to the frontend carrying tokens in the URL fragment."},
    },
)
async def microsoft_callback(
    request: Request,
    service: AuthService = Depends(get_auth_service),
):
    """Redeem the authorization code and start an application session.

    With ``FRONTEND_REDIRECT_URI`` configured the browser is bounced back to the
    app with the tokens in the URL *fragment* - fragments are not sent to
    servers and do not appear in access logs, unlike query parameters.
    """
    return await _handle_callback(request, service, dict(request.query_params))


@router.post(
    "/microsoft/callback",
    summary="Microsoft OAuth callback (form_post mode)",
    response_model=None,
    include_in_schema=False,
)
async def microsoft_callback_form_post(
    request: Request,
    service: AuthService = Depends(get_auth_service),
):
    """Same exchange for ``AUTH_RESPONSE_MODE=form_post``.

    In that mode Microsoft POSTs the authorization code as form data instead of
    putting it in the URL, which keeps it out of browser history and logs.
    """
    # Parsed directly rather than via request.form() so the service does not
    # need python-multipart for what is always a urlencoded body.
    body = (await request.body()).decode("utf-8", errors="replace")
    return await _handle_callback(request, service, dict(parse_qsl(body)))


async def _handle_callback(
    request: Request, service: AuthService, auth_response: dict
):
    user_agent, ip_address = _client_meta(request)
    tokens, redirect_after = await service.complete_login(
        auth_response, user_agent=user_agent, ip_address=ip_address
    )

    target = redirect_after or settings.FRONTEND_REDIRECT_URI
    if not target:
        return tokens

    fragment = urlencode(
        {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "expires_in": tokens.expires_in,
            "token_type": tokens.token_type,
        }
    )
    # 303 makes the browser follow with GET after a POST callback.
    return RedirectResponse(
        f"{target}#{fragment}", status_code=status.HTTP_303_SEE_OTHER
    )


@router.post("/refresh", response_model=TokenResponse, summary="Rotate the session")
async def refresh(
    payload: RefreshTokenRequest,
    request: Request,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """Exchange a refresh token for a new access token (single use, rotating)."""
    user_agent, ip_address = _client_meta(request)
    return await service.refresh_session(
        payload.refresh_token, user_agent=user_agent, ip_address=ip_address
    )


@router.post("/logout", response_model=MessageResponse, summary="End the session")
async def logout(
    payload: Optional[LogoutRequest] = None,
    user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    await service.logout(user, payload)
    return MessageResponse(message="Signed out.")


@router.get("/session", response_model=SessionInfo, summary="Inspect the current session")
async def session_info(
    user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> SessionInfo:
    return await service.build_session_info(user)


@router.get(
    "/admin-consent",
    summary="Grant tenant-wide admin consent",
    response_model=None,
    responses={307: {"description": "Redirect to the Microsoft admin consent page."}},
)
async def admin_consent(service: AuthService = Depends(get_auth_service)):
    """Directory admins use this once to consent to the app's Graph permissions."""
    return RedirectResponse(
        service.build_admin_consent_url(), status_code=status.HTTP_307_TEMPORARY_REDIRECT
    )
