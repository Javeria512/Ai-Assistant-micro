"""Manual smoke test: call every endpoint against a running server.

Usage
-----
1. Start the server:            uvicorn app.main:app --reload
2. Sign in:                     python scripts/api_smoke.py --login
   (opens the browser, then paste the access_token you get back)
3. Run the checks:              python scripts/api_smoke.py

The session is cached in .dev-session.json (gitignored) and refreshed
automatically when the access token expires, so step 2 is a one-off.

Exit code is 0 only when every check passes.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import webbrowser
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx

BASE_URL = "http://localhost:8000"
SESSION_FILE = Path(__file__).resolve().parents[1] / ".dev-session.json"

GREEN, RED, YELLOW, GREY, BOLD, RESET = (
    "\033[32m",
    "\033[31m",
    "\033[33m",
    "\033[90m",
    "\033[1m",
    "\033[0m",
)


# --------------------------------------------------------------- summarisers
def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}{'' if count == 1 else 's'}"


def sum_profile(body: Dict[str, Any]) -> str:
    return f"{body.get('display_name')} <{body.get('email')}> - {body.get('job_title') or 'no title'}"


def sum_collection(noun: str) -> Callable[[Dict[str, Any]], str]:
    def summarise(body: Dict[str, Any]) -> str:
        items = body.get("items") or []
        text = _plural(len(items), noun)
        if items:
            first = items[0]
            label = (
                first.get("subject")
                or first.get("title")
                or first.get("display_name")
                or first.get("name")
                or first.get("content")
                or ""
            )
            text += f' - first: "{str(label)[:48]}"'
        warnings = body.get("warnings") or []
        if warnings:
            text += f" [{len(warnings)} warning(s)]"
        return text

    return summarise


def sum_agenda(body: Dict[str, Any]) -> str:
    text = f"{body.get('date')} ({body.get('timezone')}): {_plural(body.get('total_meetings', 0), 'meeting')}"
    text += f", {body.get('total_meeting_minutes', 0)}min"
    if body.get("conflicts"):
        text += f", {len(body['conflicts'])} conflict(s)"
    following = body.get("next_meeting")
    if following:
        text += f" - next: \"{following.get('subject', '')[:36]}\""
    return text


def sum_priorities(body: Dict[str, Any]) -> str:
    items = body.get("items") or []
    buckets = body.get("buckets") or {}
    sources = body.get("sources") or {}
    text = (
        f"{len(items)} ranked of {body.get('total_considered', 0)} "
        f"[{buckets.get('critical', 0)} critical / {buckets.get('high', 0)} high] "
        f"(mail {sources.get('email', 0)}, mtg {sources.get('meeting', 0)}, "
        f"task {sources.get('task', 0)}, chat {sources.get('chat', 0)}) "
        f"strategy={body.get('strategy')}"
    )
    if items:
        top = items[0]
        text += f'\n        #1 [{top.get("score")}] {top.get("title", "")[:52]}'
        for reason in (top.get("reasons") or [])[:3]:
            text += f"\n           - {reason}"
    return text


def sum_brief(body: Dict[str, Any]) -> str:
    stats = body.get("stats") or {}
    return (
        f'"{body.get("headline")}"\n'
        f"        meetings={stats.get('meetings_today')} "
        f"tasks={stats.get('pending_tasks')} (overdue {stats.get('overdue_tasks')}) "
        f"unread={stats.get('unread_emails')} "
        f"awaiting_reply={stats.get('emails_awaiting_reply')} "
        f"chats_waiting={stats.get('conversations_waiting_on_me')} "
        f"ai={body.get('ai_generated')}"
    )


def sum_summary(body: Dict[str, Any]) -> str:
    text = f'"{body.get("greeting")}" - {body.get("headline")}'
    for highlight in (body.get("highlights") or [])[:3]:
        text += f"\n        - {highlight}"
    return text


def sum_session(body: Dict[str, Any]) -> str:
    scopes = body.get("microsoft_scopes") or []
    return (
        f"connected={body.get('microsoft_connected')}, "
        f"{_plural(len(scopes), 'scope')} granted"
    )


def sum_task_summary(body: Dict[str, Any]) -> str:
    return (
        f"total={body.get('total')} overdue={body.get('overdue')} "
        f"today={body.get('due_today')} week={body.get('due_this_week')} "
        f"no_due_date={body.get('no_due_date')}"
    )


# ------------------------------------------------------------------- checks
# (method, path, needs_auth, summariser, accepted status codes)
CHECKS: List[Tuple[str, str, bool, Optional[Callable], Tuple[int, ...]]] = [
    ("GET", "/", False, lambda b: b.get("message", ""), (200,)),
    ("GET", "/health", False, lambda b: f"status={b.get('status')}", (200,)),
    ("GET", "/health/ready", False, lambda b: f"database={b.get('database')}", (200,)),
    ("GET", "/auth/session", True, sum_session, (200,)),
    ("GET", "/api/v1/users/me", True, sum_profile, (200,)),
    ("GET", "/api/v1/users/me/photo", True, None, (200, 204)),
    ("GET", "/api/v1/users/me/mailbox", True, lambda b: f"timezone={b.get('timezone')}", (200,)),
    ("GET", "/api/v1/users/me/preferences", True, lambda b: f"vip={b.get('vip_contacts')}", (200,)),
    ("GET", "/api/v1/calendar/today", True, sum_agenda, (200,)),
    ("GET", "/api/v1/calendar/events?limit=10", True, sum_collection("event"), (200,)),
    ("GET", "/api/v1/calendar/conflicts", True, sum_collection("conflict"), (200,)),
    ("GET", "/api/v1/mail/messages?limit=10", True, sum_collection("message"), (200,)),
    ("GET", "/api/v1/mail/messages?limit=5&unread_only=true", True, sum_collection("unread"), (200,)),
    ("GET", "/api/v1/mail/important?limit=5", True, sum_collection("email"), (200,)),
    ("GET", "/api/v1/chats?limit=10", True, sum_collection("chat"), (200,)),
    ("GET", "/api/v1/chats/important?limit=5", True, sum_collection("chat"), (200,)),
    ("GET", "/api/v1/tasks/lists", True, sum_collection("list"), (200,)),
    ("GET", "/api/v1/tasks/pending?limit=20", True, sum_collection("task"), (200,)),
    ("GET", "/api/v1/tasks/summary", True, sum_task_summary, (200,)),
    ("GET", "/api/v1/assistant/priority-weights", True, lambda b: f"{len(b.get('effective', {}))} sources weighted", (200,)),
    ("GET", "/api/v1/assistant/priorities?limit=15", True, sum_priorities, (200,)),
    ("GET", "/api/v1/assistant/summary", True, sum_summary, (200,)),
    ("GET", "/api/v1/assistant/daily-brief", True, sum_brief, (200,)),
]


# ------------------------------------------------------------------ session
def load_session() -> Optional[Dict[str, str]]:
    if not SESSION_FILE.exists():
        return None
    try:
        return json.loads(SESSION_FILE.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None


def save_session(data: Dict[str, str]) -> None:
    SESSION_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"{GREY}Session cached in {SESSION_FILE.name}{RESET}")


def do_login(base_url: str) -> None:
    """Open the Microsoft sign-in page and store the tokens it returns."""
    url = f"{base_url}/auth/login"
    print(f"{BOLD}Opening {url}{RESET}")
    print(
        "\nSign in with your Microsoft work account. The browser will land on a\n"
        "JSON page containing access_token and refresh_token."
    )
    webbrowser.open(url)

    access_token = input("\nPaste access_token: ").strip().strip('"')
    if not access_token:
        sys.exit("No token entered.")
    refresh_token = input("Paste refresh_token (optional): ").strip().strip('"')

    save_session({"access_token": access_token, "refresh_token": refresh_token})
    print(f"{GREEN}Signed in.{RESET} Now run: python scripts/api_smoke.py")


def refresh_session(client: httpx.Client, base_url: str, session: Dict[str, str]) -> bool:
    """Try to rotate an expired access token. Returns True on success."""
    if not session.get("refresh_token"):
        return False
    response = client.post(
        f"{base_url}/auth/refresh", json={"refresh_token": session["refresh_token"]}
    )
    if response.status_code != 200:
        return False
    body = response.json()
    session["access_token"] = body["access_token"]
    session["refresh_token"] = body["refresh_token"]
    save_session(session)
    print(f"{GREY}Access token refreshed.{RESET}")
    return True


# -------------------------------------------------------------------- runner
def run_checks(base_url: str, session: Optional[Dict[str, str]], verbose: bool) -> int:
    passed = failed = skipped = 0

    with httpx.Client(timeout=60.0, follow_redirects=False) as client:
        for method, path, needs_auth, summarise, ok_codes in CHECKS:
            if needs_auth and not session:
                print(f"{YELLOW}SKIP{RESET} {method:4} {path:46} (no session - run --login)")
                skipped += 1
                continue

            headers = (
                {"Authorization": f"Bearer {session['access_token']}"}
                if needs_auth and session
                else {}
            )

            started = time.perf_counter()
            try:
                response = client.request(method, f"{base_url}{path}", headers=headers)
            except httpx.HTTPError as exc:
                print(f"{RED}FAIL{RESET} {method:4} {path:46} {exc}")
                failed += 1
                continue

            # One automatic retry after refreshing an expired session.
            if response.status_code == 401 and needs_auth and session:
                if refresh_session(client, base_url, session):
                    headers = {"Authorization": f"Bearer {session['access_token']}"}
                    response = client.request(method, f"{base_url}{path}", headers=headers)

            elapsed = (time.perf_counter() - started) * 1000
            ok = response.status_code in ok_codes
            mark = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"

            detail = ""
            if ok and summarise and response.content:
                try:
                    detail = summarise(response.json())
                except Exception as exc:  # noqa: BLE001 - summariser is cosmetic
                    detail = f"(could not summarise: {exc})"
            elif not ok:
                detail = response.text[:220]

            print(
                f"{mark} {method:4} {path:46} {response.status_code} "
                f"{elapsed:6.0f}ms  {detail}"
            )

            if verbose and ok and response.headers.get("content-type", "").startswith(
                "application/json"
            ):
                print(
                    GREY
                    + json.dumps(response.json(), indent=2, default=str)[:2500]
                    + RESET
                )

            passed += int(ok)
            failed += int(not ok)

    print(
        f"\n{BOLD}{passed} passed, {failed} failed, {skipped} skipped{RESET}"
        + (f"  {GREY}(run --login to cover the skipped ones){RESET}" if skipped else "")
    )
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--login", action="store_true", help="Sign in and cache the session.")
    parser.add_argument("--token", help="Use this access token instead of the cached one.")
    parser.add_argument("-v", "--verbose", action="store_true", help="Print full JSON bodies.")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    try:
        httpx.get(f"{base_url}/health", timeout=5.0)
    except httpx.HTTPError:
        print(
            f"{RED}Cannot reach {base_url}.{RESET} "
            "Start it with: uvicorn app.main:app --reload"
        )
        return 1

    if args.login:
        do_login(base_url)
        return 0

    session = {"access_token": args.token, "refresh_token": ""} if args.token else load_session()
    return run_checks(base_url, session, args.verbose)


if __name__ == "__main__":
    raise SystemExit(main())
