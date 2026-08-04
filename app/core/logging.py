"""Logging configuration with per-request correlation ids."""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from logging.config import dictConfig
from typing import Any, Dict, Optional

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
user_id_ctx: ContextVar[str] = ContextVar("user_id", default="-")


class ContextFilter(logging.Filter):
    """Injects the current request/user id into every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        record.user_id = user_id_ctx.get()
        return True


class JsonFormatter(logging.Formatter):
    """Single-line JSON output, suitable for container log shippers."""

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "user_id": getattr(record, "user_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", json_output: bool = False) -> None:
    formatter: Dict[str, Any] = (
        {"()": JsonFormatter}
        if json_output
        else {
            "format": (
                "%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s"
            ),
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    )

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"context": {"()": ContextFilter}},
            "formatters": {"default": formatter},
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "stream": sys.stdout,
                    "formatter": "default",
                    "filters": ["context"],
                }
            },
            "root": {"handlers": ["console"], "level": level.upper()},
            "loggers": {
                "uvicorn": {"handlers": ["console"], "level": level.upper(), "propagate": False},
                "uvicorn.access": {"handlers": ["console"], "level": "WARNING", "propagate": False},
                "uvicorn.error": {"handlers": ["console"], "level": level.upper(), "propagate": False},
                "httpx": {"level": "WARNING"},
                "httpcore": {"level": "WARNING"},
                "msal": {"level": "WARNING"},
                "sqlalchemy.engine": {"level": "WARNING"},
            },
        }
    )


def set_request_context(request_id: str, user_id: Optional[str] = None) -> None:
    request_id_ctx.set(request_id)
    if user_id:
        user_id_ctx.set(user_id)
