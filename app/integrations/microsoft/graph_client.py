"""Async Microsoft Graph HTTP client.

Responsibilities:
  * attach the bearer token and standard headers
  * follow ``@odata.nextLink`` pagination
  * honour throttling (``429`` + ``Retry-After``) and retry transient 5xx
  * translate Graph error payloads into application exceptions
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    GraphError,
    GraphPermissionError,
    NotFoundError,
    RateLimitedError,
    ReauthRequiredError,
)

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_BACKOFF_SECONDS = 20.0


class GraphClient:
    """Thin, well-behaved wrapper around the Graph REST API."""

    def __init__(
        self,
        access_token: str,
        http_client: httpx.AsyncClient,
        *,
        settings: Optional[Settings] = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._token = access_token
        self._http = http_client
        self._base_url = self._settings.GRAPH_BASE_URL.rstrip("/")
        self._max_retries = max(0, self._settings.HTTP_MAX_RETRIES)

    # ------------------------------------------------------------- internals
    def _build_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self._base_url}/{path.lstrip('/')}"

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    @staticmethod
    def _describe_error(response: httpx.Response) -> Tuple[str, str]:
        """Pull ``(code, message)`` out of a Graph error body."""
        try:
            body = response.json()
        except ValueError:
            return "unknown", response.text[:400]
        error = body.get("error") if isinstance(body, dict) else None
        if isinstance(error, dict):
            return str(error.get("code", "unknown")), str(error.get("message", ""))[:400]
        return "unknown", str(body)[:400]

    def _raise_for_status(self, response: httpx.Response, url: str) -> None:
        if response.status_code < 400:
            return

        code, message = self._describe_error(response)
        context = {"status": response.status_code, "graph_code": code, "url": url}

        if response.status_code == 401:
            raise ReauthRequiredError(
                "Microsoft rejected the access token.", details=context
            )
        if response.status_code == 403:
            raise GraphPermissionError(
                f"Microsoft Graph denied access ({code}). "
                "Check the delegated permissions granted to the app registration.",
                details=context,
            )
        if response.status_code == 404:
            raise NotFoundError("The Microsoft Graph resource was not found.", details=context)
        if response.status_code == 429:
            raise RateLimitedError("Microsoft Graph is throttling requests.", details=context)
        raise GraphError(f"Microsoft Graph error ({code}): {message}", details=context)

    @staticmethod
    def _retry_delay(response: Optional[httpx.Response], attempt: int) -> float:
        if response is not None:
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                try:
                    return min(float(retry_after), MAX_BACKOFF_SECONDS)
                except ValueError:
                    pass
        return min(2.0**attempt, MAX_BACKOFF_SECONDS)

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        url = self._build_url(path)
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries + 1):
            try:
                response = await self._http.request(
                    method,
                    url,
                    params=params,
                    headers=self._headers(headers),
                    json=json_body,
                )
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt >= self._max_retries:
                    raise GraphError(
                        "Could not reach Microsoft Graph.", details={"url": url}
                    ) from exc
                await asyncio.sleep(self._retry_delay(None, attempt))
                continue

            if response.status_code in RETRYABLE_STATUS and attempt < self._max_retries:
                delay = self._retry_delay(response, attempt)
                logger.warning(
                    "Graph %s %s -> %s, retrying in %.1fs (attempt %s/%s)",
                    method,
                    url,
                    response.status_code,
                    delay,
                    attempt + 1,
                    self._max_retries,
                )
                await asyncio.sleep(delay)
                continue

            self._raise_for_status(response, url)
            return response

        raise GraphError("Microsoft Graph request failed.", details={"url": url}) from last_error

    # ---------------------------------------------------------------- public
    async def get(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        response = await self.request("GET", path, params=params, headers=headers)
        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError:
            return {}

    async def get_collection(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        max_items: Optional[int] = None,
        max_pages: int = 10,
    ) -> List[Dict[str, Any]]:
        """Fetch a collection, following ``@odata.nextLink`` up to the limits."""
        items: List[Dict[str, Any]] = []
        payload = await self.get(path, params=params, headers=headers)
        pages = 0

        while True:
            page_items = payload.get("value") or []
            items.extend(page_items)
            pages += 1

            if max_items is not None and len(items) >= max_items:
                return items[:max_items]

            next_link = payload.get("@odata.nextLink")
            if not next_link or pages >= max_pages:
                return items

            # nextLink already carries the query string.
            payload = await self.get(next_link, headers=headers)

    async def get_bytes(
        self, path: str, *, headers: Optional[Dict[str, str]] = None
    ) -> Optional[bytes]:
        try:
            response = await self.request("GET", path, headers=headers)
        except NotFoundError:
            return None
        return response.content or None

    async def try_get_collection(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        max_items: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Collection fetch that degrades instead of failing.

        Returns ``(items, warning)``. Missing consent or an unsupported mailbox
        should never take down the whole dashboard, so those become warnings.
        """
        try:
            items = await self.get_collection(
                path, params=params, headers=headers, max_items=max_items
            )
            return items, None
        except (GraphPermissionError, NotFoundError) as exc:
            logger.warning("Graph collection %s unavailable: %s", path, exc.message)
            return [], f"{path}: {exc.message}"
        except GraphError as exc:
            logger.warning("Graph collection %s failed: %s", path, exc.message)
            return [], f"{path}: {exc.message}"


def create_http_client(settings: Optional[Settings] = None) -> httpx.AsyncClient:
    """Build the shared connection-pooled client held on ``app.state``."""
    settings = settings or get_settings()
    return httpx.AsyncClient(
        timeout=httpx.Timeout(settings.HTTP_TIMEOUT_SECONDS),
        limits=httpx.Limits(
            max_connections=settings.HTTP_MAX_CONNECTIONS,
            max_keepalive_connections=settings.HTTP_MAX_CONNECTIONS // 2 or 1,
        ),
        follow_redirects=True,
        headers={"User-Agent": f"{settings.APP_NAME}/{settings.APP_VERSION}"},
    )
