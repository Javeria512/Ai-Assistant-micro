"""Shared schema building blocks."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.utils.datetime_utils import utcnow

T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base for every DTO: tolerant of ORM objects, forbids unknown fields."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, extra="ignore")


class SourceType(str, Enum):
    """Where a unified activity item came from."""

    EMAIL = "email"
    MEETING = "meeting"
    TASK = "task"
    CHAT = "chat"


class PriorityBucket(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Importance(str, Enum):
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class Person(BaseSchema):
    name: Optional[str] = None
    address: Optional[str] = None

    @property
    def label(self) -> str:
        return self.name or self.address or "Unknown"


class Collection(BaseSchema, Generic[T]):
    """Uniform list envelope so clients can rely on one shape."""

    items: List[T] = Field(default_factory=list)
    count: int = 0
    generated_at: datetime = Field(default_factory=utcnow)
    warnings: List[str] = Field(default_factory=list)

    @classmethod
    def of(cls, items: List[T], warnings: Optional[List[str]] = None) -> "Collection[T]":
        return cls(items=items, count=len(items), warnings=warnings or [])


class HealthStatus(BaseSchema):
    status: str
    app: str
    version: str
    environment: str
    database: Optional[str] = None
    checked_at: datetime = Field(default_factory=utcnow)


class MessageResponse(BaseSchema):
    message: str
    detail: Optional[str] = None
