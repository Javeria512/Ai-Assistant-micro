"""Domain exceptions and the FastAPI handlers that render them."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for every error the application raises deliberately."""

    status_code: int = 500
    code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: Optional[str] = None,
        *,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details or {}
        super().__init__(self.message)

    def to_payload(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"error": {"code": self.code, "message": self.message}}
        if self.details:
            payload["error"]["details"] = self.details
        return payload


class ConfigurationError(AppError):
    status_code = 500
    code = "configuration_error"
    message = "The server is misconfigured."


class AuthenticationError(AppError):
    status_code = 401
    code = "unauthenticated"
    message = "Authentication is required."


class ReauthRequiredError(AppError):
    """Graph refresh failed: the user must run the Microsoft sign-in again."""

    status_code = 401
    code = "reauth_required"
    message = "Microsoft sign-in has expired. Please sign in again."


class AuthorizationError(AppError):
    status_code = 403
    code = "forbidden"
    message = "You do not have permission to perform this action."


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "The requested resource was not found."


class ValidationFailedError(AppError):
    status_code = 422
    code = "validation_failed"
    message = "The request payload is invalid."


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many requests. Please retry shortly."


class UpstreamError(AppError):
    """A dependency (typically Microsoft Graph) failed."""

    status_code = 502
    code = "upstream_error"
    message = "An upstream service failed."


class GraphError(UpstreamError):
    code = "graph_error"
    message = "Microsoft Graph request failed."


class GraphPermissionError(AppError):
    status_code = 403
    code = "graph_permission_denied"
    message = (
        "Microsoft Graph denied the request. The required delegated permission is "
        "probably missing or not consented."
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach uniform JSON error rendering to the application."""

    @app.exception_handler(AppError)
    async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        log = logger.warning if exc.status_code < 500 else logger.error
        log(
            "%s on %s %s: %s",
            exc.code,
            request.method,
            request.url.path,
            exc.message,
            extra={"details": exc.details},
        )
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_failed",
                    "message": "The request payload is invalid.",
                    "details": {"errors": exc.errors()},
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"http_{exc.status_code}",
                    "message": str(exc.detail),
                }
            },
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred.",
                }
            },
        )
