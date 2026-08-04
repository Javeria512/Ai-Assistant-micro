"""User profile schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from app.schemas.common import BaseSchema


class UserProfile(BaseSchema):
    id: str
    ms_object_id: Optional[str] = None
    display_name: Optional[str] = None
    given_name: Optional[str] = None
    surname: Optional[str] = None
    email: Optional[str] = None
    user_principal_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    office_location: Optional[str] = None
    mobile_phone: Optional[str] = None
    business_phones: List[str] = Field(default_factory=list)
    preferred_language: Optional[str] = None
    timezone: str = "UTC"
    initials: Optional[str] = None
    last_login_at: Optional[datetime] = None


class WorkingHours(BaseSchema):
    days_of_week: List[str] = Field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    timezone: Optional[str] = None


class MailboxPreferences(BaseSchema):
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    language: Optional[str] = None
    automatic_replies_status: Optional[str] = None
    working_hours: Optional[WorkingHours] = None


class UserPreferencesUpdate(BaseSchema):
    """Personalisation that feeds the priority engine."""

    timezone: Optional[str] = Field(default=None, description="IANA zone, e.g. Asia/Karachi")
    vip_contacts: Optional[List[str]] = Field(
        default=None, description="Addresses or domains always treated as high authority."
    )
    priority_weights: Optional[Dict[str, Dict[str, float]]] = Field(
        default=None,
        description='Partial weight overrides, e.g. {"email": {"sender_authority": 3.0}}',
    )


class UserPreferences(BaseSchema):
    timezone: str = "UTC"
    vip_contacts: List[str] = Field(default_factory=list)
    priority_weights: Dict[str, Any] = Field(default_factory=dict)
