# AI Executive Personal Assistant — Backend

FastAPI backend for the AI Executive Personal Assistant. It signs users in with
Microsoft OAuth 2.0 (MSAL), reads Outlook, Calendar, Teams and Tasks through
Microsoft Graph, and merges everything into one explainable, ranked worklist —
the **Single Unified Priority** system.

Built to be useful today without an LLM, and to accept one without refactoring.

---

## 1. Architecture

```
                          React Native / Web client
                                     │  session JWT (bearer)
┌────────────────────────────────────▼─────────────────────────────────────┐
│                              FastAPI app                                 │
│                                                                          │
│  api/          routing + validation only, no business logic              │
│   ├── deps.py      auth, Graph client, service wiring                    │
│   └── v1/          auth · users · mail · calendar · chats · tasks ·      │
│                    assistant · health                                    │
│                                                                          │
│  services/     business logic                                            │
│   ├── auth_service        OAuth flow, sessions, rotation                 │
│   ├── token_service       silent refresh + in-process token cache        │
│   ├── mail / calendar / chat / task / profile   per-source processing    │
│   ├── assistant_service   concurrent aggregation, brief, summary         │
│   └── priority/           weights · signals · engine   ◄── the core      │
│                                                                          │
│  ai/           LLM seam: base · factory · providers · prompts · reranker │
│  integrations/microsoft/  msal_client · graph_client · endpoints ·       │
│                           mappers  (only place that knows Graph JSON)    │
│  repositories/ data access          models/ SQLAlchemy ORM               │
│  schemas/      Pydantic DTOs        core/ config · security · logging    │
│  db/           engine + session     utils/ datetime · text               │
└──────────────┬─────────────────────────────────┬─────────────────────────┘
               │                                 │
      Microsoft Graph API                PostgreSQL / SQLite
   (Outlook · Calendar · Teams ·        (users, encrypted MSAL
    To Do · Planner · profile)           cache, refresh sessions)
```

**Dependency rule:** `api → services → repositories/integrations → models`.
Nothing flows back up, so any layer can be tested or replaced in isolation.

### What changed from the reference code

Your reference (`docs/reference_original/`) proved the OAuth handshake. It is
kept intact; these pieces were added around it:

| Reference | Now |
|---|---|
| `get_authorization_request_url` | `initiate_auth_code_flow` — adds PKCE, `state` and nonce validation |
| Callback returned the raw `code` | Code is redeemed for tokens; an app session is issued |
| No token storage | MSAL cache encrypted with Fernet, one row per user |
| No refresh | `acquire_token_silent` + rotating app refresh tokens |
| Authority/scopes hardcoded | Config-driven, per-user granted scopes honoured |
| 2 files | Layered packages with tests |

---

## 2. Quick start

```bash
python -m venv .venv
```

```bash
.venv\Scripts\activate
```

```bash
pip install -r requirements-dev.txt
```

Copy `.env.example` to `.env` and fill in your Azure app registration values,
then:

```bash
uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs> for interactive API docs, or
<http://localhost:8000/auth/login> to run the sign-in flow in a browser.

### Azure app registration checklist

1. **Redirect URI** (platform: *Web*) must exactly equal `REDIRECT_URI`,
   default `http://localhost:8000/auth/microsoft/callback`.
2. **API permissions → Microsoft Graph → Delegated**, add every scope in
   `GRAPH_SCOPES`:
   `User.Read`, `Mail.Read`, `Calendars.Read`, `Tasks.ReadWrite`, `Chat.Read`,
   `People.Read`, `MailboxSettings.Read`.
3. Have an admin hit `/auth/admin-consent` once for tenant-wide consent.

Scopes you have not consented to simply degrade: the affected endpoint returns
an empty list plus a `warnings` entry instead of failing.

---

## 3. API

`/auth/*` is unversioned because the callback path is registered in Azure.
Everything else lives under `/api/v1`.

### Authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/login` | Redirect to Microsoft (`?response=json` returns the URL instead) |
| GET/POST | `/auth/microsoft/callback` | Redeem the code, issue a session |
| POST | `/auth/refresh` | Rotate the refresh token, mint a new access token |
| POST | `/auth/logout` | Revoke this session, all sessions, or the Microsoft cache |
| GET | `/auth/session` | Inspect the current session and granted scopes |
| GET | `/auth/admin-consent` | Tenant-wide consent for admins |

### Data

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/users/me` | **User profile** |
| GET | `/api/v1/users/me/photo` | Profile photo (204 when unset) |
| GET | `/api/v1/users/me/mailbox` | Timezone, working hours, auto-replies |
| GET/PATCH | `/api/v1/users/me/preferences` | VIP contacts, timezone, priority weights |
| GET | `/api/v1/calendar/today` | **Daily meetings** — agenda, conflicts, free gaps |
| GET | `/api/v1/calendar/events` | Events in an arbitrary window |
| GET | `/api/v1/calendar/conflicts` | Overlapping meetings |
| GET | `/api/v1/mail/messages` | Mailbox listing (filter, search, unread) |
| GET | `/api/v1/mail/important` | **Important emails** — ranked, not just the Outlook flag |
| GET | `/api/v1/mail/messages/{id}` | One message with body |
| GET | `/api/v1/chats` | Recent Teams chats |
| GET | `/api/v1/chats/important` | **Important conversations** |
| GET | `/api/v1/chats/{id}/messages` | Messages in a chat |
| GET | `/api/v1/tasks/pending` | **Pending tasks** (To Do + Planner) |
| GET | `/api/v1/tasks`, `/lists`, `/summary` | Full task surface |

### Assistant

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/assistant/priorities` | **Single Unified Priority list** |
| GET | `/api/v1/assistant/daily-brief` | Everything the dashboard needs, one call |
| GET | `/api/v1/assistant/summary` | **User summary** — headline, highlights, focus |
| GET | `/api/v1/assistant/priority-weights` | Inspect effective scoring weights |

---

## 4. Single Unified Priority system

Emails, meetings, tasks and Teams conversations are reduced to one
`PriorityItem` shape and scored by one model, so a single list can answer
*"what should I do next?"* across every system.

```
raw items → signal extraction → weighted average → hard rules
          → bucketing → (optional) LLM rerank → ranked list
```

### Signals

Every signal is normalised to `0.0–1.0` (`services/priority/signals.py`):

| Signal | What it measures |
|---|---|
| `time_pressure` | Minutes to meeting start, due-date proximity/overdue, message age |
| `explicit_importance` | High-importance flag, follow-up flag, Planner priority band |
| `direct_targeting` | To vs CC, required attendee, organizer, @mention, 1:1 chat |
| `sender_authority` | VIP list, internal vs external, frequent correspondent |
| `unresolved` | Unread, unanswered thread, invite not responded, task not started |
| `urgency_language` | Three-tier lexicon (`outage`/`asap` › `deadline`/`sign off` › `follow up`) |
| `engagement_scope` | Audience size — a 1:1 outranks a 200-person blast |
| `staleness` | Something unanswered for days quietly climbs |
| `conflict` | Meeting overlaps another meeting |

### Scoring

`score = 100 × Σ(weight × value) / Σ(weight)`, per-source weights in
`services/priority/weights.py`. Then hard rules that pure averaging gets wrong:

- meeting in progress → floor **92**; starting within 15 min → floor **88**
- overdue task → floor **70**
- unread, addressed to you, from a VIP → floor **65**
- automated/newsletter email → × **0.45**

Buckets: `critical ≥ 78`, `high ≥ 58`, `medium ≥ 38`, else `low`.

### Explainability

Every item ships the signals and reasons behind its score — the ranking is
auditable, and the same structure grounds the LLM prompt:

```json
{
  "id": "email:AAMkAGI2...",
  "source": "email",
  "title": "Budget sign-off needed before Friday",
  "score": 81.4,
  "bucket": "critical",
  "rank": 2,
  "reasons": [
    "Sender is on your VIP list",
    "Unread and still waiting for you",
    "Wording signals urgency (\"sign off\")"
  ],
  "signals": [
    {"name": "sender_authority", "value": 1.0, "weight": 2.2, "contribution": 2.2},
    {"name": "unresolved", "value": 1.0, "weight": 2.0, "contribution": 2.0}
  ],
  "action_hint": "Reply",
  "deep_link": "https://outlook.office.com/mail/id/AAMkAGI2..."
}
```

### Tuning

Per user, no deploy needed:

```bash
curl -X PATCH http://localhost:8000/api/v1/users/me/preferences \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"vip_contacts": ["ceo@acme.com", "board.acme.com"],
       "priority_weights": {"email": {"sender_authority": 3.0}}}'
```

---

## 5. Security

- **Microsoft tokens never leave the server.** Clients get an application
  session JWT; Graph access/refresh tokens live only in the encrypted MSAL
  cache.
- **Encryption at rest** — the MSAL cache and in-flight OAuth state are
  Fernet-encrypted (`TOKEN_ENCRYPTION_KEY`).
- **PKCE + one-time state**, persisted server-side and rejected on replay.
- **Rotating refresh tokens** — single use, only SHA-256 hashes stored, reuse
  invalidates the session.
- **No tokens in query strings.** The post-login redirect uses the URL
  *fragment*, which browsers do not send to servers or write to access logs.
  Set `AUTH_RESPONSE_MODE=form_post` to also keep the authorization code out of
  the URL.
- **Open-redirect guard** — `redirect_uri` is validated against
  `FRONTEND_REDIRECT_URI` and `CORS_ORIGINS`.

Production requires `SECRET_KEY` and `TOKEN_ENCRYPTION_KEY` to be set
explicitly; the app refuses to start on derived development keys when
`ENVIRONMENT=production`.

> **Note:** `.env` currently holds a live client secret and is now gitignored.
> If that file has ever been shared or committed, rotate the secret in Azure
> (*Certificates & secrets → New client secret*).

---

## 6. Reliability

- Graph 429/5xx are retried with `Retry-After` and exponential backoff.
- `@odata.nextLink` pagination is followed with page and item caps.
- Aggregate endpoints fan out with `asyncio.gather` and degrade per source —
  a missing Planner licence adds a `warnings` entry, it does not 500 the brief.
- MSAL is synchronous, so every call runs in a worker thread; access tokens are
  cached in-process with a 2-minute expiry skew and a per-user lock.
- Uniform error envelope: `{"error": {"code", "message", "details"}}`, plus
  `X-Request-ID` correlation on every response.

---

## 7. AI integration

Everything above is deterministic and works with `LLM_PROVIDER=none`. Setting a
provider upgrades the *same* endpoints:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

- `ai/base.py` — `LLMProvider` protocol; add a provider by implementing it.
- `ai/prompts/templates.py` — versioned prompts, ready to become LangGraph nodes.
- `ai/reranker.py` — the model may only nudge scores by ±25 **with a stated
  reason**; it cannot add, drop or silently reorder items.
- `assistant_service` writes the narrative from a structured snapshot, so the
  model summarises real data instead of inventing it.

If the LLM call fails or returns malformed JSON, the deterministic result is
returned — AI never breaks an endpoint.

**Next up (per the project doc):** RAG over meeting notes and documents with
Qdrant/ChromaDB, then LangGraph agents. The seams are `ai/factory.py` and the
`PriorityReranker` protocol.

---

## 8. Testing

Three levels, in the order you should use them.

### Level 1 — automated suite (no Microsoft account needed)

```bash
.venv\Scripts\python.exe -m pytest -q
```

39 tests, ~2 seconds:

| File | Covers |
|---|---|
| `test_priority_engine.py` | Scoring behaviour — VIP > ordinary, CC < direct, overdue floors, automated suppression, cross-source ranking, weight overrides |
| `test_mappers.py` | Graph JSON → schemas, using realistic payloads (7-digit fractional seconds, `dateTimeTimeZone`, `identitySet`) |
| `test_assistant_flow.py` | Full aggregation against a stubbed Graph: collect → prioritise → daily brief, plus graceful degradation when a source 403s |
| `test_api_smoke.py` | Real ASGI app — routing, 401s, error envelope, OpenAPI generation |

Run one behaviour at a time while developing:

```bash
.venv\Scripts\python.exe -m pytest tests/test_priority_engine.py -v
```

### Level 2 — interactive docs

```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs>. Every endpoint has a **Try it out** button.
Unauthenticated endpoints (`/`, `/health`, `/health/ready`) work immediately;
for the rest, sign in first (below) and paste the token into **Authorize**.

### Level 3 — real data, end to end

Sign in once, then run every endpoint against your live mailbox:

```bash
.venv\Scripts\python.exe scripts/api_smoke.py --login
```

That opens the Microsoft sign-in page. Because `FRONTEND_REDIRECT_URI` is empty,
the browser lands on a JSON page — paste `access_token` and `refresh_token` back
into the prompt. They are cached in `.dev-session.json` (gitignored) and rotated
automatically, so this is a one-off.

```bash
.venv\Scripts\python.exe scripts/api_smoke.py
```

```
PASS GET  /api/v1/users/me            200   412ms  Alex Manager <alex@acme.com> - Operations Manager
PASS GET  /api/v1/calendar/today      200   690ms  2026-07-31 (Asia/Karachi): 4 meetings, 210.0min, 1 conflict(s)
PASS GET  /api/v1/tasks/pending       200   980ms  7 tasks - first: "Submit compliance report"
PASS GET  /api/v1/assistant/priorities 200 1240ms  18 ranked of 61 [2 critical / 5 high]
        #1 [92.0] Incident review
           - Happening right now
           - You have not responded to the invite
```

Add `-v` to dump full JSON bodies. The exit code is 0 only when every check
passes, so it drops straight into CI.

### What to check when something looks wrong

**Start with `GET /auth/session`.** It reports `account_type`, the scopes
Microsoft *actually issued*, and `missing_scopes` / `unavailable_features`.
Entra silently drops scopes it will not grant for the signed-in identity, so a
permission ticked in Azure is not proof it was granted.

#### Personal vs work/school accounts

Signing in with a consumer account (`outlook.com`, `hotmail.com`, or a Gmail
address registered as a Microsoft account) puts you in tenant
`9188040d-6c67-4c5b-b112-36a304b66dad`. Those accounts **cannot** use the Teams
chats API — `Chat.Read` is dropped from the token and `/me/chats` answers a bare
`401`. Mail, calendar, tasks and profile all work normally.

The backend detects this and skips Teams with an explanatory warning rather than
calling an endpoint that cannot succeed. For Teams, sign in with a work or
school account that has a Teams licence.

- **`warnings` in a response** — that source was unavailable, usually a missing
  scope or an unsupported account type.
- **`401 reauth_required`** — the Microsoft refresh token is gone; sign in again.
- **`403 graph_permission_denied`** — the scope is not consented; run
  `/auth/admin-consent`.
- **Teams warns even though Azure shows `Chat.Read` granted** — check
  `account_type` on `/auth/session`; a personal account can never use it.
- **Empty priority list** — expected on a quiet account. Confirm the inputs with
  `/api/v1/mail/messages` and `/api/v1/calendar/today` first.
- Every response carries `X-Request-ID`; grep the server log for it to see the
  full story of one request.

---

## 9. Deployment

```bash
docker compose up --build
```

Set `DATABASE_URL=postgresql+asyncpg://...` and uncomment `asyncpg` in
`requirements.txt` for PostgreSQL. `init_db()` creates tables on startup for
convenience; adopt Alembic before the first production schema change.

## 10. Project layout

```
app/
├── main.py                     app factory, middleware, lifespan
├── api/            deps.py, router.py, v1/{auth,users,mail,calendar,chats,tasks,assistant,health}.py
├── core/           config.py, security.py, logging.py, exceptions.py
├── db/             base.py, session.py
├── models/         user.py, ms_token.py, auth_flow.py, session.py
├── repositories/   user, ms_token, auth_flow, refresh_session
├── schemas/        common, auth, user, mail, calendar, chat, task, priority, assistant
├── integrations/microsoft/  msal_client.py, graph_client.py, endpoints.py, mappers.py
├── services/       auth, token, profile, mail, calendar, chat, task, assistant
│   └── priority/   weights.py, signals.py, engine.py
├── ai/             base.py, factory.py, reranker.py, providers/, prompts/
└── utils/          datetime_utils.py, text.py
docs/reference_original/        your original working OAuth code, unchanged
tests/
```
