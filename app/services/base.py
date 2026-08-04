"""Shared plumbing for every Microsoft Graph backed service."""

from __future__ import annotations

from typing import List, Optional

from app.integrations.microsoft.graph_client import GraphClient
from app.integrations.microsoft.mappers import GraphIdentity
from app.models.user import User


class GraphService:
    """Base class carrying the authenticated client plus "who am I" context."""

    def __init__(self, client: GraphClient, user: User) -> None:
        self.client = client
        self.user = user
        self.warnings: List[str] = []
        self.identity = GraphIdentity.build(
            object_id=user.ms_object_id,
            display_name=user.display_name,
            addresses=[user.email, user.user_principal_name],
        )

    @property
    def timezone(self) -> str:
        return self.user.timezone or "UTC"

    def _warn(self, warning: Optional[str]) -> None:
        if warning and warning not in self.warnings:
            self.warnings.append(warning)
