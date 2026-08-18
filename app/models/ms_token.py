"""Encrypted MSAL token cache, one row per user."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_uuid


class MsTokenCache(Base, TimestampMixin):
    """Serialized ``msal.SerializableTokenCache`` protected with Fernet.

    Holding the whole MSAL cache (rather than raw access/refresh tokens) lets
    MSAL own refresh, scope matching and expiry logic.
    """

    __tablename__ = "ms_token_caches"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    encrypted_cache: Mapped[str] = mapped_column(Text, nullable=False)
    scopes: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    # Expiry of the last access token we saw; informational/diagnostic only.
    access_token_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_refreshed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User", back_populates="token_cache")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MsTokenCache user={self.user_id}>"
