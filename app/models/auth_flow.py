"""Short-lived OAuth authorization-code flow state.

MSAL's ``initiate_auth_code_flow`` returns a dict holding the ``state``, PKCE
``code_verifier`` and nonce. It must survive the browser round-trip, so it is
persisted (encrypted) and consumed exactly once in the callback.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AuthFlowState(Base, TimestampMixin):
    __tablename__ = "auth_flow_states"

    state: Mapped[str] = mapped_column(String(128), primary_key=True)
    encrypted_flow: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Optional client-supplied return target, validated against an allow-list.
    redirect_after: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AuthFlowState {self.state[:8]}...>"
