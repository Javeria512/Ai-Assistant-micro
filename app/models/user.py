"""Application user, mirrored from the Microsoft Entra ID profile."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_uuid

# Well-known tenant id issued to consumer (personal) Microsoft accounts.
# Several Graph APIs - notably Teams chats - exist only for work/school
# identities, so this distinction drives real behaviour, not just display.
MSA_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad"


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_ms_oid", "ms_object_id", unique=True),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_uuid)

    # Stable Microsoft identifiers
    ms_object_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ms_tenant_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ms_home_account_id: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)

    # Profile snapshot (refreshed on each login)
    user_principal_name: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    given_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    office_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Personalisation used by the priority engine.
    # vip_contacts: ["ceo@acme.com", "board@acme.com"]
    vip_contacts: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    # priority_weights: partial override of PriorityWeights, e.g.
    # {"email": {"sender_authority": 3.0}}
    priority_weights: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    granted_scopes: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    token_cache = relationship(
        "MsTokenCache",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    sessions = relationship(
        "RefreshSession",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    # ------------------------------------------------------------- properties
    @property
    def is_personal_account(self) -> bool:
        """True for consumer accounts (outlook.com, hotmail.com, MSA-linked gmail)."""
        return (self.ms_tenant_id or "").lower() == MSA_TENANT_ID

    @property
    def account_type(self) -> str:
        return "personal" if self.is_personal_account else "work_or_school"

    def has_scope(self, scope: str) -> bool:
        """Whether Microsoft actually issued a scope.

        Entra silently drops scopes it will not grant for the signed-in identity
        (for example ``Chat.Read`` on a personal account), so the granted list -
        not the Azure app registration - is the source of truth.
        """
        target = scope.rsplit("/", 1)[-1].lower()
        return any(
            granted.rsplit("/", 1)[-1].lower() == target
            for granted in (self.granted_scopes or [])
        )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.id} {self.user_principal_name}>"
