"""Test fixtures.

Environment is configured *before* importing anything from ``app`` because
settings are read once at import time.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP_DB = Path(tempfile.gettempdir()) / "ai_assistant_test.db"
os.environ.setdefault("CLIENT_ID", "test-client-id")
os.environ.setdefault("CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("TENANT_ID", "test-tenant-id")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_TMP_DB.as_posix()}")
os.environ.setdefault("LLM_PROVIDER", "none")

import pytest  # noqa: E402

from app.models.user import User  # noqa: E402
from app.services.priority.signals import PriorityContext  # noqa: E402
from app.utils.datetime_utils import utcnow  # noqa: E402


@pytest.fixture
def now():
    return utcnow()


@pytest.fixture
def user() -> User:
    return User(
        id="u1",
        ms_object_id="oid-1",
        ms_tenant_id="tid-1",
        email="manager@acme.com",
        user_principal_name="manager@acme.com",
        display_name="Alex Manager",
        given_name="Alex",
        timezone="UTC",
        vip_contacts=["ceo@acme.com"],
        priority_weights={},
        granted_scopes=[],
    )


@pytest.fixture
def context(now) -> PriorityContext:
    return PriorityContext(
        now=now,
        timezone="UTC",
        user_addresses={"manager@acme.com"},
        user_object_id="oid-1",
        vip_contacts={"ceo@acme.com"},
        frequent_contacts=set(),
        replied_thread_keys=set(),
    )
