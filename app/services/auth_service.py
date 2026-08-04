"""Sign-in, session issuance, refresh and sign-out orchestration."""

from __future__ import annotations

import logging
from typing import Mapping, Optional, Tuple
from urllib.parse import urlparse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import AppError, AuthenticationError
from app.core.security import create_access_token, generate_refresh_token
from app.integrations.microsoft import endpoints
from app.integrations.microsoft.graph_client import GraphClient
from app.integrations.microsoft.msal_client import (
    MicrosoftIdentityClient,
    get_identity_client,
)
from app.models.user import User
from app.repositories.auth_flow_repository import AuthFlowRepository
from app.repositories.ms_token_repository import MsTokenRepository
from app.repositories.refresh_session_repository import RefreshSessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginUrlResponse,
    LogoutRequest,
    SessionInfo,
    SessionUser,
    TokenResponse,
)
from app.services.token_service import TokenService
from app.utils.datetime_utils import to_iana_name

logger = logging.getLogger(__name__)


def _session_user(user: User) -> SessionUser:
    return SessionUser(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        user_principal_name=user.user_principal_name,
        job_title=user.job_title,
        timezone=user.timezone or "UTC",
    )


class AuthService:
    """Owns the OAuth 2.0 authorization-code flow and application sessions."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        http_client: Optional[httpx.AsyncClient] = None,
        identity_client: Optional[MicrosoftIdentityClient] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self._session = session
        self._http = http_client
        self._settings = settings or get_settings()
        self._identity = identity_client or get_identity_client()

        self._users = UserRepository(session)
        self._flows = AuthFlowRepository(session)
        self._sessions = RefreshSessionRepository(session)
        self._ms_tokens = MsTokenRepository(session)
        self._token_service = TokenService(session, self._identity)

    # ------------------------------------------------------------ login start
    def _validate_redirect_after(self, target: Optional[str]) -> Optional[str]:
        """Only allow post-login redirects we explicitly trust (open-redirect guard)."""
        if not target:
            return None
        allowed = [self._settings.FRONTEND_REDIRECT_URI] + self._settings.cors_origins
        allowed = [item for item in allowed if item]
        for candidate in allowed:
            if target == candidate or target.startswith(candidate.rstrip("/") + "/"):
                return target
        # Custom scheme deep links (React Native) are matched on the scheme.
        parsed = urlparse(target)
        for candidate in allowed:
            if parsed.scheme and parsed.scheme == urlparse(candidate).scheme:
                return target
        logger.warning("Rejected untrusted post-login redirect target.")
        return None

    async def start_login(
        self,
        *,
        redirect_after: Optional[str] = None,
        login_hint: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> LoginUrlResponse:
        """Build the Microsoft authorization URL and remember the PKCE flow."""
        flow = await self._identity.initiate_auth_code_flow(
            login_hint=login_hint, prompt=prompt
        )
        await self._flows.save(
            flow,
            ttl_seconds=self._settings.AUTH_FLOW_TTL_SECONDS,
            redirect_after=self._validate_redirect_after(redirect_after),
        )
        await self._flows.purge_expired()

        return LoginUrlResponse(
            authorization_url=flow["auth_uri"],
            state=flow["state"],
            expires_in=self._settings.AUTH_FLOW_TTL_SECONDS,
        )

    # --------------------------------------------------------- login callback
    async def complete_login(
        self,
        query_params: Mapping[str, str],
        *,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[TokenResponse, Optional[str]]:
        """Redeem the authorization code and issue an application session."""
        if query_params.get("error"):
            raise AuthenticationError(
                query_params.get("error_description") or "Microsoft returned an error.",
                code=query_params.get("error", "ms_auth_error"),
            )

        state = query_params.get("state")
        if not state:
            raise AuthenticationError("The sign-in response is missing the state value.")

        flow_row = await self._flows.consume(state)
        if flow_row is None:
            raise AuthenticationError(
                "This sign-in attempt is unknown, expired or already used. Start again.",
                code="invalid_state",
            )
        flow = AuthFlowRepository.decode_flow(flow_row)
        if flow is None:
            raise AuthenticationError("Stored sign-in state could not be read.")

        token_result, serialized_cache = await self._identity.redeem_auth_code(
            flow, dict(query_params)
        )

        object_id = token_result.object_id
        if not object_id:
            raise AuthenticationError("Microsoft did not return a user object id.")

        user = await self._users.upsert_from_login(
            ms_object_id=object_id,
            ms_tenant_id=token_result.tenant_id,
            ms_home_account_id=token_result.home_account_id,
            user_principal_name=token_result.username,
            email=(token_result.id_token_claims.get("email") or token_result.username),
            display_name=token_result.id_token_claims.get("name"),
            granted_scopes=token_result.scopes,
        )
        await self._token_service.store_initial_cache(
            user,
            serialized_cache,
            scopes=token_result.scopes,
            expires_in=token_result.expires_in,
        )

        await self._hydrate_profile(user, token_result.access_token)

        token_response = await self._issue_session(
            user, user_agent=user_agent, ip_address=ip_address
        )
        return token_response, flow_row.redirect_after

    async def _hydrate_profile(self, user: User, access_token: str) -> None:
        """Best-effort enrichment from ``/me`` and ``/me/mailboxSettings``."""
        if self._http is None:
            return
        client = GraphClient(access_token, self._http)
        try:
            profile = await client.get(
                endpoints.ME, params={"$select": endpoints.USER_SELECT}
            )
            await self._users.apply_graph_profile(user, profile)
        except AppError as exc:
            logger.warning("Could not load Microsoft profile at login: %s", exc.message)

        try:
            mailbox = await client.get(endpoints.ME_MAILBOX_SETTINGS)
            await self._users.set_timezone(user, to_iana_name(mailbox.get("timeZone")))
        except AppError as exc:
            logger.info(
                "Mailbox settings unavailable (timezone stays %s): %s",
                user.timezone,
                exc.message,
            )

    # ------------------------------------------------------------- sessions
    async def _issue_session(
        self,
        user: User,
        *,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> TokenResponse:
        access_token, expires_at = create_access_token(
            user.id,
            extra_claims={"email": user.email, "name": user.display_name},
            settings=self._settings,
        )
        refresh_token = generate_refresh_token()
        await self._sessions.create(
            user_id=user.id,
            raw_token=refresh_token,
            ttl_days=self._settings.REFRESH_TOKEN_TTL_DAYS,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        return TokenResponse(
            access_token=access_token,
            expires_in=self._settings.ACCESS_TOKEN_TTL_MINUTES * 60,
            expires_at=expires_at,
            refresh_token=refresh_token,
            user=_session_user(user),
        )

    async def refresh_session(
        self,
        refresh_token: str,
        *,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> TokenResponse:
        """Rotate the refresh token and mint a new access token."""
        current = await self._sessions.get_active(refresh_token)
        if current is None:
            raise AuthenticationError(
                "Refresh token is invalid, expired or already used.",
                code="invalid_refresh_token",
            )

        user = await self._users.get_by_id(current.user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("The account is no longer active.")

        new_refresh_token = generate_refresh_token()
        await self._sessions.rotate(
            current,
            raw_token=new_refresh_token,
            ttl_days=self._settings.REFRESH_TOKEN_TTL_DAYS,
        )

        access_token, expires_at = create_access_token(
            user.id,
            extra_claims={"email": user.email, "name": user.display_name},
            settings=self._settings,
        )
        return TokenResponse(
            access_token=access_token,
            expires_in=self._settings.ACCESS_TOKEN_TTL_MINUTES * 60,
            expires_at=expires_at,
            refresh_token=new_refresh_token,
            user=_session_user(user),
        )

    async def logout(self, user: User, payload: Optional[LogoutRequest] = None) -> None:
        payload = payload or LogoutRequest()

        if payload.all_sessions or payload.forget_microsoft_account:
            revoked = await self._sessions.revoke_all_for_user(user.id)
            logger.info("Revoked %s session(s) for user %s", revoked, user.id)
        elif payload.refresh_token:
            row = await self._sessions.get_active(payload.refresh_token)
            if row is not None and row.user_id == user.id:
                await self._sessions.revoke(row)

        if payload.forget_microsoft_account:
            await self._token_service.forget_microsoft_account(user)
        else:
            TokenService.invalidate_cached_token(user.id)

    async def build_session_info(self, user: User) -> SessionInfo:
        scopes = await self._ms_tokens.get_scopes(user.id)
        cache = await self._ms_tokens.get_cache(user.id)
        _, expires_at = create_access_token(user.id, settings=self._settings)

        granted = scopes or list(user.granted_scopes or [])
        requested = self._settings.graph_scopes
        granted_bare = {item.rsplit("/", 1)[-1].lower() for item in granted}
        missing = [
            scope for scope in requested if scope.rsplit("/", 1)[-1].lower() not in granted_bare
        ]

        return SessionInfo(
            user=_session_user(user),
            session_expires_at=expires_at,
            microsoft_connected=bool(cache),
            last_login_at=user.last_login_at,
            account_type=user.account_type,
            microsoft_scopes=sorted(granted),
            requested_scopes=requested,
            missing_scopes=missing,
            unavailable_features=self._unavailable_features(user, missing),
        )

    @staticmethod
    def _unavailable_features(user: User, missing: list) -> list:
        """Translate missing scopes / account type into plain statements."""
        notes = []
        missing_bare = {scope.rsplit("/", 1)[-1].lower() for scope in missing}

        if user.is_personal_account:
            notes.append(
                "Teams chats: not available for personal Microsoft accounts "
                "(sign in with a work or school account)."
            )
        elif "chat.read" in missing_bare:
            notes.append("Teams chats: Chat.Read was not granted.")

        if {"tasks.read", "tasks.readwrite"} & missing_bare == {"tasks.read", "tasks.readwrite"}:
            notes.append("Tasks: no Tasks scope was granted.")
        if "mailboxsettings.read" in missing_bare:
            notes.append(
                "Timezone/working hours: MailboxSettings.Read was not granted; "
                "times fall back to the stored timezone."
            )
        if "mail.read" in missing_bare:
            notes.append("Outlook mail: Mail.Read was not granted.")
        if "calendars.read" in missing_bare:
            notes.append("Calendar: Calendars.Read was not granted.")
        return notes

    def build_admin_consent_url(self, state: Optional[str] = None) -> str:
        return self._identity.build_admin_consent_url(state=state)
