"""End-to-end smoke tests over the real ASGI app (no Microsoft calls)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_root_banner(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "AI Assistant Backend Running"
    assert body["login"] == "/auth/login"


def test_health_and_readiness(client):
    assert client.get("/health").json()["status"] == "ok"

    ready = client.get("/health/ready").json()
    assert ready["status"] == "ok"
    assert ready["database"] == "ok"


def test_request_id_header_is_returned(client):
    response = client.get("/health")
    assert response.headers.get("X-Request-ID")
    assert response.headers.get("X-Response-Time-ms")


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/users/me",
        "/api/v1/mail/messages",
        "/api/v1/calendar/today",
        "/api/v1/tasks/pending",
        "/api/v1/chats",
        "/api/v1/assistant/priorities",
        "/api/v1/assistant/daily-brief",
        "/api/v1/assistant/summary",
    ],
)
def test_protected_endpoints_require_a_session(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_invalid_bearer_token_is_rejected(client):
    response = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_refresh_rejects_unknown_token(client):
    response = client.post(
        "/auth/refresh", json={"refresh_token": "x" * 40}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"


def test_callback_rejects_unknown_state(client):
    response = client.get(
        "/auth/microsoft/callback", params={"code": "abc", "state": "never-issued"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_state"


def test_form_post_callback_parses_body(client):
    """AUTH_RESPONSE_MODE=form_post posts urlencoded data instead of a query."""
    response = client.post(
        "/auth/microsoft/callback",
        data={"code": "abc", "state": "never-issued"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_state"


def test_callback_surfaces_microsoft_errors(client):
    response = client.get(
        "/auth/microsoft/callback",
        params={"error": "access_denied", "error_description": "User cancelled"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "User cancelled"


def test_openapi_document_builds(client):
    spec = client.get("/openapi.json").json()
    assert spec["info"]["title"]
    assert "/api/v1/assistant/priorities" in spec["paths"]
