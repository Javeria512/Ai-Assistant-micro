"""MSAL wrapper for the Microsoft OAuth 2.0 authorization-code flow.

Notes on the design:

* ``msal`` is synchronous and performs network I/O, so every call is pushed to a
  worker thread with ``run_in_threadpool`` to keep the event loop free.
* The MSAL ``SerializableTokenCache`` is the single source of truth for tokens.
  It is loaded from the database, handed to MSAL, and written back whenever MSAL
  reports a change - that is how refresh tokens get persisted and rotated.
* ``initiate_auth_code_flow`` / ``acquire_token_by_auth_code_flow`` are used
  instead of the simpler ``get_authorization_request_url`` because they add
  PKCE, ``state`` and ``nonce`` validation for free.
"""

from __future__ import annotations

import functools
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

from msal import ConfidentialClientApplication, SerializableTokenCache
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError, ConfigurationError, ReauthRequiredError

logger = logging.getLogger(__name__)

# MSAL injects these itself and raises ValueError if they are passed in.
RESERVED_SCOPES = frozenset({"openid", "profile", "offline_access"})

# Errors that mean "the user must sign in interactively again".
INTERACTION_REQUIRED_ERRORS = frozenset(
    {
        "invalid_grant",
        "interaction_required",
        "consent_required",
        "login_required",
        "token_expired",
    }
)


def sanitize_scopes(scopes: Optional[List[str]]) -> List[str]:
    """Drop reserved/blank scopes and de-duplicate, preserving Graph URIs."""
    cleaned: List[str] = []
    for scope in scopes or []:
        candidate = (scope or "").strip()
        if not candidate:
            continue
        bare = candidate.rsplit("/", 1)[-1].lower()
        if candidate.lower() in RESERVED_SCOPES or bare in RESERVED_SCOPES:
            continue
        cleaned.append(candidate)
    return sorted(set(cleaned))


@dataclass
class TokenResult:
    """Normalised view of an MSAL token response."""

    access_token: str
    expires_in: int
    scopes: List[str] = field(default_factory=list)
    id_token_claims: Dict[str, Any] = field(default_factory=dict)
    home_account_id: Optional[str] = None

    @property
    def object_id(self) -> Optional[str]:
        return self.id_token_claims.get("oid")

    @property
    def tenant_id(self) -> Optional[str]:
        return self.id_token_claims.get("tid")

    @property
    def username(self) -> Optional[str]:
        return self.id_token_claims.get("preferred_username") or self.id_token_claims.get(
            "upn"
        )


def _token_result(result: Dict[str, Any], account: Optional[Dict[str, Any]]) -> TokenResult:
    claims = result.get("id_token_claims") or {}
    home_account_id = None
    if account:
        home_account_id = account.get("home_account_id")
    if not home_account_id and claims.get("oid") and claims.get("tid"):
        home_account_id = f"{claims['oid']}.{claims['tid']}"

    return TokenResult(
        access_token=result["access_token"],
        expires_in=int(result.get("expires_in") or 3600),
        scopes=(result.get("scope") or "").split() if result.get("scope") else [],
        id_token_claims=claims,
        home_account_id=home_account_id,
    )


def _raise_for_msal_error(result: Dict[str, Any], *, during: str) -> None:
    error = result.get("error")
    if not error:
        return

    description = result.get("error_description") or ""
    details = {
        "error": error,
        "description": description[:500],
        "correlation_id": result.get("correlation_id"),
    }
    logger.warning("MSAL %s failed: %s - %s", during, error, description[:300])

    if error in INTERACTION_REQUIRED_ERRORS or "AADSTS50076" in description:
        raise ReauthRequiredError(
            "Microsoft sign-in is no longer valid. Please sign in again.",
            details=details,
        )
    if "AADSTS65001" in description:
        raise AuthenticationError(
            "The requested Microsoft Graph permissions have not been consented to. "
            "An administrator can grant them via /auth/admin-consent.",
            code="consent_required",
            details=details,
        )
    raise AuthenticationError(
        f"Microsoft sign-in failed ({error}).", code="ms_auth_failed", details=details
    )


class MicrosoftIdentityClient:
    """All Microsoft Entra ID interactions live here."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        if not self._settings.CLIENT_ID or not self._settings.CLIENT_SECRET:
            raise ConfigurationError("CLIENT_ID and CLIENT_SECRET must be configured.")
        self.default_scopes = sanitize_scopes(self._settings.graph_scopes)

    # ------------------------------------------------------------- internals
    def _build_app(
        self, cache: Optional[SerializableTokenCache] = None
    ) -> ConfidentialClientApplication:
        return ConfidentialClientApplication(
            client_id=self._settings.CLIENT_ID,
            client_credential=self._settings.CLIENT_SECRET,
            authority=self._settings.authority,
            token_cache=cache,
        )

    @staticmethod
    def _load_cache(serialized: Optional[str]) -> SerializableTokenCache:
        cache = SerializableTokenCache()
        if serialized:
            try:
                cache.deserialize(serialized)
            except Exception:  # noqa: BLE001 - corrupt cache must not be fatal
                logger.warning("Stored MSAL cache could not be deserialized; starting fresh.")
        return cache

    @staticmethod
    def _dump_cache(cache: SerializableTokenCache) -> Optional[str]:
        return cache.serialize() if cache.has_state_changed else None

    @staticmethod
    def _pick_account(
        accounts: List[Dict[str, Any]], home_account_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        if not accounts:
            return None
        if home_account_id:
            for account in accounts:
                if account.get("home_account_id") == home_account_id:
                    return account
        return accounts[0]

    # ------------------------------------------------------- interactive leg
    def _initiate_sync(self, login_hint: Optional[str], prompt: Optional[str]) -> Dict[str, Any]:
        app = self._build_app()
        return app.initiate_auth_code_flow(
            scopes=self.default_scopes,
            redirect_uri=self._settings.REDIRECT_URI,
            login_hint=login_hint,
            prompt=prompt,
            response_mode=self._settings.AUTH_RESPONSE_MODE,
        )

    async def initiate_auth_code_flow(
        self, *, login_hint: Optional[str] = None, prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Return the MSAL flow dict (contains ``auth_uri`` and ``state``)."""
        flow = await run_in_threadpool(
            functools.partial(self._initiate_sync, login_hint, prompt)
        )
        if "auth_uri" not in flow:
            raise AuthenticationError(
                "Could not build the Microsoft authorization URL.",
                code="ms_auth_init_failed",
                details={"flow_keys": sorted(flow.keys())},
            )
        return flow

    def _redeem_sync(
        self, flow: Dict[str, Any], auth_response: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Optional[str], Optional[Dict[str, Any]]]:
        cache = SerializableTokenCache()
        app = self._build_app(cache)
        try:
            result = app.acquire_token_by_auth_code_flow(flow, auth_response)
        except ValueError as exc:
            # MSAL raises ValueError for state/nonce mismatch and similar
            # client-side validation problems.
            raise AuthenticationError(
                f"Microsoft sign-in response rejected: {exc}", code="ms_auth_invalid_response"
            ) from exc

        account = None
        if "access_token" in result:
            claims = result.get("id_token_claims") or {}
            username = claims.get("preferred_username") or claims.get("upn")
            accounts = app.get_accounts(username=username) or app.get_accounts()
            account = accounts[0] if accounts else None
        return result, self._dump_cache(cache), account

    async def redeem_auth_code(
        self, flow: Dict[str, Any], auth_response: Dict[str, Any]
    ) -> Tuple[TokenResult, Optional[str]]:
        """Exchange the authorization code for tokens.

        Returns the token result plus the serialized MSAL cache to persist.
        """
        result, serialized_cache, account = await run_in_threadpool(
            functools.partial(self._redeem_sync, flow, auth_response)
        )
        _raise_for_msal_error(result, during="authorization code redemption")
        if "access_token" not in result:
            raise AuthenticationError(
                "Microsoft did not return an access token.", code="ms_auth_no_token"
            )
        return _token_result(result, account), serialized_cache

    # ------------------------------------------------------------ silent leg
    def _silent_sync(
        self,
        serialized_cache: Optional[str],
        home_account_id: Optional[str],
        scopes: List[str],
        force_refresh: bool,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[Dict[str, Any]]]:
        cache = self._load_cache(serialized_cache)
        app = self._build_app(cache)
        account = self._pick_account(app.get_accounts(), home_account_id)
        if account is None:
            return None, None, None

        result = app.acquire_token_silent_with_error(
            scopes, account=account, force_refresh=force_refresh
        )
        return result, self._dump_cache(cache), account

    async def acquire_token_silent(
        self,
        serialized_cache: Optional[str],
        *,
        home_account_id: Optional[str] = None,
        scopes: Optional[List[str]] = None,
        force_refresh: bool = False,
    ) -> Tuple[TokenResult, Optional[str]]:
        """Get a fresh Graph access token, refreshing it when needed.

        Raises ``ReauthRequiredError`` when the cached refresh token is gone or
        rejected, which the API surfaces as ``401 reauth_required``.
        """
        requested = sanitize_scopes(scopes) or self.default_scopes
        result, updated_cache, account = await run_in_threadpool(
            functools.partial(
                self._silent_sync, serialized_cache, home_account_id, requested, force_refresh
            )
        )

        if result is None:
            raise ReauthRequiredError(
                "No cached Microsoft credentials for this user. Please sign in again."
            )
        _raise_for_msal_error(result, during="silent token acquisition")
        if "access_token" not in result:
            raise ReauthRequiredError(
                "Microsoft token cache no longer holds a usable token. Please sign in again."
            )
        return _token_result(result, account), updated_cache

    # --------------------------------------------------------------- sign out
    def _forget_sync(
        self, serialized_cache: Optional[str], home_account_id: Optional[str]
    ) -> Optional[str]:
        cache = self._load_cache(serialized_cache)
        app = self._build_app(cache)
        account = self._pick_account(app.get_accounts(), home_account_id)
        if account is not None:
            app.remove_account(account)
        return cache.serialize()

    async def forget_account(
        self, serialized_cache: Optional[str], *, home_account_id: Optional[str] = None
    ) -> Optional[str]:
        """Remove the account (and its refresh token) from the cached state."""
        return await run_in_threadpool(
            functools.partial(self._forget_sync, serialized_cache, home_account_id)
        )

    # ---------------------------------------------------------- admin consent
    def build_admin_consent_url(self, *, state: Optional[str] = None) -> str:
        """Tenant-wide admin consent URL for the configured app registration."""
        params = {
            "client_id": self._settings.CLIENT_ID,
            "redirect_uri": self._settings.REDIRECT_URI,
        }
        if state:
            params["state"] = state
        return f"{self._settings.admin_consent_authority}/adminconsent?{urlencode(params)}"


@functools.lru_cache(maxsize=1)
def get_identity_client() -> MicrosoftIdentityClient:
    return MicrosoftIdentityClient()
