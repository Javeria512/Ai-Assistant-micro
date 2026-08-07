"""Microsoft Graph resource paths and the ``$select`` projections we use.

Keeping selects explicit keeps payloads small and makes the exact Graph
contract auditable in one place.
"""

from __future__ import annotations

# --------------------------------------------------------------------- user
ME = "/me"
ME_PHOTO = "/me/photo/$value"
ME_MAILBOX_SETTINGS = "/me/mailboxSettings"
ME_MANAGER = "/me/manager"
ME_PEOPLE = "/me/people"

USER_SELECT = ",".join(
    [
        "id",
        "displayName",
        "givenName",
        "surname",
        "mail",
        "userPrincipalName",
        "jobTitle",
        "department",
        "officeLocation",
        "mobilePhone",
        "businessPhones",
        "preferredLanguage",
    ]
)

# --------------------------------------------------------------------- mail
ME_MESSAGES = "/me/messages"
ME_MAIL_FOLDER_MESSAGES = "/me/mailFolders/{folder_id}/messages"
ME_MESSAGE = "/me/messages/{message_id}"
ME_SENT_MESSAGES = "/me/mailFolders/sentitems/messages"

MESSAGE_SELECT = ",".join(
    [
        "id",
        "conversationId",
        "conversationIndex",
        "subject",
        "bodyPreview",
        "importance",
        "isRead",
        "isDraft",
        "hasAttachments",
        "receivedDateTime",
        "sentDateTime",
        "from",
        "sender",
        "toRecipients",
        "ccRecipients",
        "replyTo",
        "flag",
        "categories",
        "inferenceClassification",
        "webLink",
    ]
)

MESSAGE_DETAIL_SELECT = MESSAGE_SELECT + ",body,internetMessageId"

# ----------------------------------------------------------------- calendar
ME_CALENDAR_VIEW = "/me/calendarView"
ME_EVENTS = "/me/events"
ME_EVENT = "/me/events/{event_id}"

EVENT_SELECT = ",".join(
    [
        "id",
        "iCalUId",
        "subject",
        "bodyPreview",
        "start",
        "end",
        "isAllDay",
        "isCancelled",
        "isOrganizer",
        "importance",
        "sensitivity",
        "showAs",
        "location",
        "organizer",
        "attendees",
        "responseStatus",
        "onlineMeeting",
        "isOnlineMeeting",
        "onlineMeetingUrl",
        "onlineMeetingProvider",
        "seriesMasterId",
        "type",
        "categories",
        "webLink",
    ]
)

# -------------------------------------------------------------------- teams
ME_CHATS = "/me/chats"
ME_CHAT_MESSAGES = "/chats/{chat_id}/messages"
ME_CHAT_MEMBERS = "/chats/{chat_id}/members"

CHAT_SELECT = ",".join(
    ["id", "topic", "chatType", "createdDateTime", "lastUpdatedDateTime", "webUrl", "viewpoint"]
)

CHAT_MESSAGE_SELECT = ",".join(
    [
        "id",
        "createdDateTime",
        "lastModifiedDateTime",
        "messageType",
        "importance",
        "from",
        "body",
        "mentions",
        "attachments",
        "webUrl",
    ]
)

# -------------------------------------------------------------------- tasks
ME_TODO_LISTS = "/me/todo/lists"
ME_TODO_TASKS = "/me/todo/lists/{list_id}/tasks"

# Deliberately no TODO_TASK_SELECT: Graph rejects `title` inside `$select` on
# todoTask with `invalidRequest` (400), and `title` is the one field the task
# list cannot be rendered without. Verified field-by-field against a live
# tenant — every other field in the old projection was accepted; only `title`
# failed, which took the whole request down with it. The default representation
# already returns everything `map_todo_task` reads, so the projection bought
# nothing. Do not reintroduce `$select` here without re-testing `title`.

# Planner (requires Tasks.Read/ReadWrite; plan/bucket lookups also need Group.Read.All)
ME_PLANNER_TASKS = "/me/planner/tasks"
PLANNER_PLAN = "/planner/plans/{plan_id}"

PLANNER_TASK_SELECT = ",".join(
    [
        "id",
        "planId",
        "bucketId",
        "title",
        "percentComplete",
        "priority",
        "dueDateTime",
        "startDateTime",
        "createdDateTime",
        "completedDateTime",
        "hasDescription",
        "assigneePriority",
        "createdBy",
    ]
)

# ------------------------------------------------------------------ headers
PREFER_UTC = 'outlook.timezone="UTC"'
PREFER_TEXT_BODY = 'outlook.body-content-type="text"'
