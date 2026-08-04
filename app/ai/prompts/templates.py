"""Prompt templates.

Prompts live here (not inline in services) so they can be versioned, reviewed
and later swapped for LangGraph nodes without touching business logic.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

EXECUTIVE_ASSISTANT_SYSTEM = (
    "You are the executive assistant to an operations manager. "
    "You receive a structured snapshot of their Outlook, Teams, Calendar and "
    "task data. Be concise, specific and action-oriented. "
    "Never invent meetings, people, deadlines or numbers that are not in the "
    "data. Refer to time relative to now (for example 'in 40 minutes'). "
    "Write in plain professional English, no marketing tone, no emoji."
)

DAILY_BRIEF_INSTRUCTION = (
    "Write a short daily briefing of at most 120 words. "
    "Lead with the single most time-critical item, then cover meetings, "
    "anything overdue, and who is waiting on a reply. "
    "End with one concrete suggestion for how to sequence the next two hours."
)

RERANK_INSTRUCTION = (
    "You are re-ranking a pre-scored worklist. The deterministic score already "
    "accounts for deadlines, sender importance and unread state. Only adjust an "
    "item when the text clearly shows the rule-based score misjudged it "
    "(for example a 'FYI only' note scored high, or a quiet message that is "
    "actually a production incident). "
    'Reply with JSON: {"adjustments": [{"id": "<item id>", "delta": <-25..25>, '
    '"reason": "<short reason>"}]}. Return an empty list when nothing needs '
    "changing. Never invent ids."
)


def build_daily_brief_prompt(snapshot: Dict[str, Any]) -> str:
    """User-turn content for the daily brief narrative."""
    return (
        f"{DAILY_BRIEF_INSTRUCTION}\n\n"
        f"Snapshot (JSON):\n{json.dumps(snapshot, default=str, ensure_ascii=False)}"
    )


def build_rerank_prompt(items: List[Dict[str, Any]]) -> str:
    return (
        f"{RERANK_INSTRUCTION}\n\n"
        f"Items (JSON):\n{json.dumps(items, default=str, ensure_ascii=False)}"
    )
