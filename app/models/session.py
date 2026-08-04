"""Application refresh sessions (our own, not Microsoft's)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_uuid


class RefreshSession(Base, TimestampMixin):
    """One row per issued refresh token. Rotated on every use."""

    __tablename__ = "refresh_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Only the SHA-256 hash is stored, so a database leak cannot be replayed.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rotated_to: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    user = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RefreshSession {self.id} user={self.user_id}>"
