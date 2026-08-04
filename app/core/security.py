"""Cryptographic helpers: session JWTs, refresh tokens, token-cache encryption.

Microsoft access/refresh tokens never leave the server. Clients receive an
application session JWT instead; the MSAL token cache is stored encrypted at
rest with Fernet (AES-128-CBC + HMAC).
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError

logger = logging.getLogger(__name__)

TOKEN_TYPE_ACCESS = "access"


def utcnow() -> datetime:
    """Timezone-aware current UTC time (never use naive datetimes)."""
    return datetime.now(timezone.utc)


# --------------------------------------------------------------- encryption
_fernet_cache: Dict[str, Fernet] = {}


def _fernet(settings: Optional[Settings] = None) -> Fernet:
    settings = settings or get_settings()
    key = settings.TOKEN_ENCRYPTION_KEY or ""
    if key not in _fernet_cache:
        try:
            _fernet_cache[key] = Fernet(key.encode("ascii"))
        except (ValueError, TypeError) as exc:  # pragma: no cover - config error
            raise AuthenticationError(
                "TOKEN_ENCRYPTION_KEY is not a valid Fernet key.",
                code="configuration_error",
                status_code=500,
            ) from exc
    return _fernet_cache[key]


def encrypt_text(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_text(ciphertext: str) -> Optional[str]:
    """Decrypt, returning ``None`` when the payload cannot be read.

    A ``None`` result means the encryption key rotated (or the row is corrupt);
    callers treat that as "cache missing" and ask the user to sign in again.
    """
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        logger.warning("Failed to decrypt stored payload; treating it as absent.")
        return None


# --------------------------------------------------------------- session JWT
def create_access_token(
    subject: str,
    *,
    extra_claims: Optional[Dict[str, Any]] = None,
    settings: Optional[Settings] = None,
) -> Tuple[str, datetime]:
    """Issue a signed session token. Returns ``(token, expires_at)``."""
    settings = settings or get_settings()
    issued_at = utcnow()
    expires_at = issued_at + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
        "typ": TOKEN_TYPE_ACCESS,
    }
    if extra_claims:
        payload.update(extra_claims)

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def decode_access_token(
    token: str, *, settings: Optional[Settings] = None
) -> Dict[str, Any]:
    """Verify and decode a session token, or raise ``AuthenticationError``."""
    settings = settings or get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError(
            "Session token has expired.", code="token_expired"
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Session token is invalid.") from exc

    if claims.get("typ") != TOKEN_TYPE_ACCESS:
        raise AuthenticationError("Wrong token type for this endpoint.")
    return claims


# ------------------------------------------------------------ refresh tokens
def generate_refresh_token() -> str:
    """Opaque, high-entropy refresh token (only its hash is persisted)."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_equals(left: str, right: str) -> bool:
    return secrets.compare_digest(left, right)


def new_state_token() -> str:
    """CSRF state value for the OAuth authorization request."""
    return secrets.token_urlsafe(32)
