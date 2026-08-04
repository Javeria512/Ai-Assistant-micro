"""Text normalisation helpers used by the Graph mappers and priority engine."""

from __future__ import annotations

import html
import re
from typing import Iterable, List, Optional, Sequence

_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_WHITESPACE_RE = re.compile(r"\s+")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def strip_html(value: Optional[str]) -> str:
    """Convert an HTML body to readable plain text."""
    if not value:
        return ""
    text = _SCRIPT_RE.sub(" ", value)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return collapse_whitespace(text)


def collapse_whitespace(value: Optional[str]) -> str:
    if not value:
        return ""
    return _WHITESPACE_RE.sub(" ", value).strip()


def snippet(value: Optional[str], limit: int = 220) -> str:
    """Trim to ``limit`` characters on a word boundary."""
    text = collapse_whitespace(value)
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut.rstrip()}..."


def normalize_email(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def email_domain(value: Optional[str]) -> str:
    address = normalize_email(value)
    return address.rsplit("@", 1)[-1] if "@" in address else ""


def extract_emails(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [match.lower() for match in _EMAIL_RE.findall(value)]


def contains_any(haystack: Optional[str], needles: Iterable[str]) -> bool:
    if not haystack:
        return False
    lowered = haystack.lower()
    return any(needle in lowered for needle in needles)


def count_matches(haystack: Optional[str], needles: Sequence[str]) -> int:
    if not haystack:
        return 0
    lowered = haystack.lower()
    return sum(1 for needle in needles if needle in lowered)


def initials(name: Optional[str]) -> str:
    parts = [part for part in collapse_whitespace(name).split(" ") if part]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def clean_subject(subject: Optional[str]) -> str:
    """Strip ``RE:``/``FW:`` prefixes so threads group consistently."""
    text = collapse_whitespace(subject)
    while True:
        stripped = re.sub(r"^(re|fw|fwd|aw|antwort)\s*:\s*", "", text, flags=re.IGNORECASE)
        if stripped == text:
            return text
        text = stripped
