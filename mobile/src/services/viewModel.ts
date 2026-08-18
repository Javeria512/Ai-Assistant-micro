/**
 * Maps backend DTOs onto the shapes the design's screens render.
 *
 * The design was drawn against a fixed scenario; the backend returns whatever
 * the signed-in user actually has. Everything here is about making real data
 * fit those slots without inventing values — where the backend has no
 * equivalent for a design element, the element is dropped rather than faked.
 *
 * One `buildViewModel` call per daily brief; every screen reads its slice out
 * of the result. That keeps the mapping in one testable place instead of spread
 * across six screens.
 */

import { SOURCE_SCOPES } from '../constants/content';
import type {
  CalendarEvent,
  Conversation,
  DailyBrief,
  EmailMessage,
  PriorityBucket,
  PriorityItem,
  SessionInfo,
  TaskItem,
} from '../models/api';
import type {
  AgendaEntry,
  MessageCard,
  Reminder,
  SheetContent,
  SummaryRow,
  SummaryTarget,
  TaskCard,
  ViewModel,
  Vivid,
  WeekDay,
} from '../models/view';
import { clockTime, clockTimeWide, initialsOf, longDate, relativeMinutes } from '../utils';

/* ── priority → palette ───────────────────────────────────────────── */

const BUCKET_VIVID: Record<PriorityBucket, Vivid> = {
  critical: 'vividRose',
  high: 'vividAmber',
  medium: 'vividPeri',
  low: 'vividTeal',
};

const BUCKET_TONE: Record<PriorityBucket, MessageCard['priority']['tone']> = {
  critical: 'rose',
  high: 'amber',
  medium: 'neutral',
  low: 'neutral',
};

const BUCKET_LABEL: Record<PriorityBucket, string> = {
  critical: 'Critical',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

/** Agenda cards cycle through three fills so consecutive events stay distinct. */
const AGENDA_TONES: AgendaEntry['tone'][] = ['peri', 'amber', 'lime'];

/** Progress bars on task cards cycle likewise, unless the task is overdue. */
const TASK_BARS: Vivid[] = ['vividTeal', 'vividRose', 'vividPeri', 'vividAmber'];

/** How many entries each summarising surface shows. */
const SUMMARY_ROWS = 3;
const REMINDER_ROWS = 3;
const MAX_TASK_CATEGORIES = 6;
const MAX_AVATARS = 3;
const WEEK_DAYS = 5;

/* ── helpers ──────────────────────────────────────────────────────── */

/** Finds the priority entry that describes a given source object, if any. */
function priorityFor(
  priorities: PriorityItem[],
  source: PriorityItem['source'],
  id: string,
): PriorityItem | undefined {
  return priorities.find((p) => p.source === source && p.source_id === id);
}

function sheetFrom(
  title: string,
  meta: string,
  kicker: string,
  points: string[],
  source: string,
  reply?: string,
  primary = 'Done',
  secondary = 'Close',
  name?: string,
): SheetContent {
  return {
    title,
    meta,
    kicker,
    points: points.length ? points : ['No further detail was returned for this item.'],
    source,
    hasReply: !!reply,
    reply,
    primary,
    secondary,
    name,
  };
}

/** Builds the five-day strip centred on today. */
function weekStrip(today: Date): WeekDay[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: WeekDay[] = [];
  // Monday-anchored working week.
  const offset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - Math.min(offset, WEEK_DAYS - 1));
  for (let i = 0; i < WEEK_DAYS; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push({
      day: names[d.getDay()],
      date: String(d.getDate()),
      active: d.toDateString() === today.toDateString(),
    });
  }
  return out;
}

/** `09:30am – 10:15am`, dropping either side the backend left null. */
const timeRange = (start: string | null, end: string | null) =>
  [clockTime(start), clockTime(end)].filter(Boolean).join(' – ');

/* ── section mappers ──────────────────────────────────────────────── */

function mapAgenda(
  brief: DailyBrief,
  sheets: Record<string, SheetContent>,
): AgendaEntry[] {
  return brief.meetings.map((ev: CalendarEvent, i) => {
    const pri = priorityFor(brief.priorities, 'meeting', ev.id);
    const attendees = ev.attendees.slice(0, MAX_AVATARS).map((a) => ({
      label: initialsOf(a.name ?? a.address ?? ''),
    }));
    const extra = ev.attendee_count - attendees.length;
    if (extra > 0) attendees.push({ label: `+${extra}` });

    sheets[`meeting:${ev.id}`] = sheetFrom(
      ev.subject,
      timeRange(ev.start, ev.end) +
        (ev.location ? ` · ${ev.location}` : '') +
        (ev.attendee_count ? ` · ${ev.attendee_count} people` : ''),
      pri ? 'Why this matters' : 'About this meeting',
      pri?.reasons?.length ? pri.reasons : [ev.preview].filter(Boolean),
      ev.is_online_meeting
        ? 'From your Microsoft calendar · online meeting'
        : 'From your Microsoft calendar',
      undefined,
      ev.join_url ? 'Join' : 'Got it',
      'Close',
    );

    return {
      id: ev.id,
      title: ev.subject,
      subtitle: ev.is_recurring
        ? 'Recurring'
        : ev.has_conflict
          ? 'Conflicts with another event'
          : ev.location || (ev.is_online_meeting ? 'Online meeting' : 'Scheduled'),
      time: timeRange(ev.start, ev.end),
      rail: clockTime(ev.start),
      tone: AGENDA_TONES[i % AGENDA_TONES.length],
      avatars: attendees.length ? attendees : undefined,
    };
  });
}

function mapEmails(
  brief: DailyBrief,
  sheets: Record<string, SheetContent>,
): MessageCard[] {
  return brief.important_emails.map((m: EmailMessage) => {
    const pri = priorityFor(brief.priorities, 'email', m.id);
    const bucket = pri?.bucket ?? (m.importance === 'high' ? 'high' : 'medium');
    const who = m.sender?.name ?? m.sender?.address ?? 'Unknown sender';
    const key = `email:${m.id}`;
    const meta = `${who} · Outlook${m.received_at ? ` · ${clockTime(m.received_at)}` : ''}`;

    sheets[key] = sheetFrom(
      m.clean_subject || m.subject,
      meta,
      'What this is about',
      pri?.reasons?.length ? pri.reasons : [m.preview].filter(Boolean),
      'From your Outlook mailbox',
      pri?.action_hint ?? undefined,
      'Open in Outlook',
      'Later',
      who,
    );

    return {
      id: key,
      title: m.clean_subject || m.subject,
      meta,
      initials: initialsOf(who),
      avatar: BUCKET_VIVID[bucket],
      priority: { label: BUCKET_LABEL[bucket], tone: BUCKET_TONE[bucket] },
      deadline: m.is_flagged ? 'Flagged' : !m.is_read ? 'Unread' : 'Read',
      progress: scoreToProgress(pri),
      bar: BUCKET_VIVID[bucket],
      suggestion: pri?.action_hint ?? undefined,
      channel: 'Outlook',
      urgent: isUrgent(bucket),
    };
  });
}

function mapConversations(
  brief: DailyBrief,
  sheets: Record<string, SheetContent>,
): MessageCard[] {
  return brief.important_conversations.map((c: Conversation) => {
    const pri = priorityFor(brief.priorities, 'chat', c.id);
    const bucket = pri?.bucket ?? (c.waiting_on_me ? 'high' : 'medium');
    const who = c.last_message_from?.name ?? c.display_name;
    const key = `chat:${c.id}`;
    const title = c.display_name || c.topic || 'Conversation';
    const meta = `${who} · Teams${
      c.last_activity_at ? ` · ${clockTime(c.last_activity_at)}` : ''
    }`;

    sheets[key] = sheetFrom(
      title,
      meta,
      'What this is about',
      pri?.reasons?.length ? pri.reasons : [c.last_message_preview].filter(Boolean),
      'From Microsoft Teams',
      pri?.action_hint ?? undefined,
      'Open in Teams',
      'Later',
      who,
    );

    return {
      id: key,
      title,
      meta,
      initials: initialsOf(who),
      avatar: BUCKET_VIVID[bucket],
      priority: { label: BUCKET_LABEL[bucket], tone: BUCKET_TONE[bucket] },
      deadline: c.waiting_on_me
        ? 'Waiting on you'
        : c.mentions_me
          ? 'You were mentioned'
          : 'Unread',
      progress: scoreToProgress(pri),
      bar: BUCKET_VIVID[bucket],
      suggestion: pri?.action_hint ?? undefined,
      channel: 'Teams',
      urgent: isUrgent(bucket),
    };
  });
}

function mapTasks(
  brief: DailyBrief,
  sheets: Record<string, SheetContent>,
  ownerName: string | null | undefined,
): TaskCard[] {
  return brief.pending_tasks.map((t: TaskItem, i) => {
    const pri = priorityFor(brief.priorities, 'task', t.id);
    const bar = t.is_overdue ? 'vividRose' : TASK_BARS[i % TASK_BARS.length];
    const due = t.is_overdue
      ? 'Overdue'
      : t.due_at
        ? `Due ${clockTime(t.due_at)}`
        : 'No due date';
    const meta = `${due}${t.list_name ? ` · ${t.list_name}` : ''}`;

    sheets[`task:${t.id}`] = sheetFrom(
      t.title,
      meta,
      pri ? 'Why this is ranked here' : 'About this task',
      pri?.reasons?.length ? pri.reasons : [t.notes].filter(Boolean),
      t.list_name ? `From ${t.list_name}` : 'From Microsoft To Do',
      undefined,
      'Got it',
      'Close',
    );

    return {
      id: t.id,
      title: t.title,
      meta,
      owner: { initials: initialsOf(ownerName, 'ME'), bg: bar },
      bar,
      category: t.list_name ?? 'Other',
      percent: t.percent_complete ?? 0,
    };
  });
}

function mapSummaryRows(brief: DailyBrief): SummaryRow[] {
  const goFor = (src: PriorityItem['source']): SummaryTarget =>
    src === 'meeting' ? 'Calendar' : src === 'task' ? 'Tasks' : 'Chats';

  return brief.priorities.slice(0, SUMMARY_ROWS).map((item) => ({
    dot: BUCKET_VIVID[item.bucket],
    go: goFor(item.source),
    parts: [
      { text: item.title, strong: true },
      {
        text: item.reasons[0]
          ? ` — ${item.reasons[0]}`
          : item.snippet
            ? ` — ${item.snippet}`
            : '',
      },
    ],
  }));
}

function mapReminders(brief: DailyBrief): Reminder[] {
  return brief.priorities.slice(0, REMINDER_ROWS).map((item) => ({
    icon: (item.source === 'meeting'
      ? 'clock'
      : item.source === 'task'
        ? 'doc'
        : 'warnTriangle') as Reminder['icon'],
    tone: (isUrgent(item.bucket)
      ? 'rose'
      : item.source === 'meeting'
        ? 'teal'
        : 'peri') as Reminder['tone'],
    title: item.title,
    meta:
      item.reasons[0] ??
      item.subtitle ??
      `${item.source} · ${BUCKET_LABEL[item.bucket].toLowerCase()}`,
  }));
}

/** A ranked item's score becomes a 0–1 bar, floored so it is always visible. */
function scoreToProgress(pri: PriorityItem | undefined): number {
  return pri ? Math.min(1, Math.max(0.08, pri.score / 100)) : 0.4;
}

const isUrgent = (bucket: PriorityBucket) => bucket === 'critical' || bucket === 'high';

/* ── entry point ──────────────────────────────────────────────────── */

export function buildViewModel(brief: DailyBrief, session: SessionInfo | null): ViewModel {
  const p = brief.profile;
  const s = brief.stats;

  // Detail-sheet bodies are collected as a side effect of mapping each section,
  // because every sheet is built from the same DTO its card is.
  const sheets: Record<string, SheetContent> = {};

  const agenda = mapAgenda(brief, sheets);
  const messages = [...mapEmails(brief, sheets), ...mapConversations(brief, sheets)];
  const tasks = mapTasks(brief, sheets, p.display_name);

  const upcoming =
    brief.meetings.find((m) => (m.starts_in_minutes ?? -1) >= 0) ?? brief.meetings[0];
  const upcomingPri = upcoming
    ? priorityFor(brief.priorities, 'meeting', upcoming.id)
    : undefined;

  const missing = new Set((session?.missing_scopes ?? []).map((x) => x.toLowerCase()));

  return {
    user: {
      name: p.display_name ?? 'Signed in',
      firstName: p.given_name ?? p.display_name?.split(' ')[0] ?? 'there',
      initials: p.initials ?? initialsOf(p.display_name),
      role: [p.job_title, p.department].filter(Boolean).join(' · ') || (p.email ?? ''),
      today: longDate(brief.date ?? brief.generated_at),
      greeting: brief.greeting,
    },
    glance: {
      meetings: s.meetings_today,
      tasks: s.pending_tasks,
      urgent: s.critical_items + s.high_priority_items,
      replies: s.conversations_waiting_on_me + s.emails_awaiting_reply,
    },
    headline: brief.headline,
    summaryRows: mapSummaryRows(brief),
    week: weekStrip(new Date(brief.generated_at)),
    nextUp: upcoming
      ? {
          id: upcoming.id,
          title: upcoming.subject,
          time: [
            clockTimeWide(upcoming.start),
            relativeMinutes(upcoming.starts_in_minutes),
          ]
            .filter(Boolean)
            .join(' · '),
          points: upcomingPri?.reasons?.length
            ? upcomingPri.reasons
            : [upcoming.preview].filter(Boolean),
          cta: upcoming.join_url ? 'Join meeting' : 'View details',
        }
      : null,
    agenda,
    messages,
    tasks,
    taskCategories: Array.from(new Set(tasks.map((t) => t.category))).slice(
      0,
      MAX_TASK_CATEGORIES,
    ),
    priorityInsight: brief.narrative ?? brief.headline ?? null,
    stats: [
      { value: String(s.meetings_today), label: 'Meetings', tone: 'teal' },
      { value: String(s.pending_tasks), label: 'Open tasks', tone: 'peri' },
      { value: String(s.overdue_tasks), label: 'Overdue', tone: 'amber' },
    ],
    sources: SOURCE_SCOPES.map((x) => ({
      name: x.name,
      connected: !missing.has(x.scope.toLowerCase()),
    })),
    reminders: mapReminders(brief),
    sheets,
    warnings: brief.warnings ?? [],
  };
}
