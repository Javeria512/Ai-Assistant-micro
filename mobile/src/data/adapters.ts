/**
 * Maps backend DTOs onto the shapes the design's screens render.
 *
 * The design was drawn against a fixed scenario; the backend returns whatever
 * the signed-in user actually has. Everything here is about making real data
 * fit those slots without inventing values — where the backend has no
 * equivalent for a design element, the element is dropped rather than faked.
 */

import type {
  CalendarEvent,
  Conversation,
  DailyBrief,
  EmailMessage,
  PriorityBucket,
  PriorityItem,
  SessionInfo,
  TaskItem,
} from '../api/types';
import type { SheetContent } from './content';

/* ── formatting ───────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');

export function clockTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(d.getMinutes())}${suffix}`;
}

export function clockTimeWide(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

export function relativeMinutes(mins: number | null | undefined): string {
  if (mins == null) return '';
  const m = Math.round(mins);
  if (m < 0) return 'started';
  if (m === 0) return 'now';
  if (m < 60) return `in ${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.round(m / 60);
  return `in ${h} hour${h === 1 ? '' : 's'}`;
}

export function longDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── palette mapping ──────────────────────────────────────────────── */

export type Vivid = 'vividTeal' | 'vividPeri' | 'vividAmber' | 'vividRose';
export type Tone = 'rose' | 'amber' | 'neutral';

const BUCKET_VIVID: Record<PriorityBucket, Vivid> = {
  critical: 'vividRose',
  high: 'vividAmber',
  medium: 'vividPeri',
  low: 'vividTeal',
};

const BUCKET_TONE: Record<PriorityBucket, Tone> = {
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

/* ── view model ───────────────────────────────────────────────────── */

export type GlanceTile = { title: string; detail: string };

export type SummaryRow = {
  dot: Vivid;
  parts: { text: string; strong?: boolean }[];
  go: 'Calendar' | 'Tasks' | 'Chats';
};

export type AgendaEntry = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  rail: string;
  tone: 'peri' | 'amber' | 'lime';
  avatars?: { label: string; bg?: string }[];
};

export type MessageCard = {
  id: string;
  title: string;
  meta: string;
  initials: string;
  avatar: Vivid;
  priority: { label: string; tone: Tone };
  deadline: string;
  progress: number;
  bar: Vivid;
  suggestion?: string;
  channel: 'Outlook' | 'Teams';
  urgent: boolean;
};

export type TaskCard = {
  id: string;
  title: string;
  meta: string;
  owner: { initials: string; bg: Vivid };
  bar: Vivid;
  category: string;
  /** Server-side completion; the local check-off overrides it to 100. */
  percent: number;
};

export type ViewModel = {
  user: {
    name: string;
    firstName: string;
    initials: string;
    role: string;
    today: string;
    greeting: string;
  };
  /** Raw counts; the tiles format them so local edits can adjust the numbers. */
  glance: { meetings: number; tasks: number; urgent: number; replies: number };
  headline: string;
  summaryRows: SummaryRow[];
  week: { day: string; date: string; active: boolean }[];
  nextUp: { id: string; title: string; time: string; points: string[]; cta: string } | null;
  agenda: AgendaEntry[];
  messages: MessageCard[];
  tasks: TaskCard[];
  taskCategories: string[];
  priorityInsight: string | null;
  stats: { value: string; label: string; tone: 'teal' | 'peri' | 'amber' }[];
  sources: { name: string; connected: boolean }[];
  reminders: { icon: 'warnTriangle' | 'clock' | 'doc'; tone: 'rose' | 'teal' | 'peri'; title: string; meta: string }[];
  sheets: Record<string, SheetContent>;
  warnings: string[];
};

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
function weekStrip(today: Date) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: { day: string; date: string; active: boolean }[] = [];
  // Monday-anchored working week.
  const offset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - Math.min(offset, 4));
  for (let i = 0; i < 5; i += 1) {
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

const AGENDA_TONES: AgendaEntry['tone'][] = ['peri', 'amber', 'lime'];

export function buildViewModel(
  brief: DailyBrief,
  session: SessionInfo | null,
): ViewModel {
  const p = brief.profile;
  const s = brief.stats;
  const sheets: Record<string, SheetContent> = {};

  /* meetings ------------------------------------------------------- */
  const agenda: AgendaEntry[] = brief.meetings.map((ev: CalendarEvent, i) => {
    const pri = priorityFor(brief.priorities, 'meeting', ev.id);
    const attendees = ev.attendees.slice(0, 3).map((a) => ({
      label: initialsOf(a.name ?? a.address ?? ''),
    }));
    const extra = ev.attendee_count - attendees.length;
    if (extra > 0) attendees.push({ label: `+${extra}` });

    sheets[`meeting:${ev.id}`] = sheetFrom(
      ev.subject,
      [clockTime(ev.start), clockTime(ev.end)].filter(Boolean).join(' – ') +
        (ev.location ? ` · ${ev.location}` : '') +
        (ev.attendee_count ? ` · ${ev.attendee_count} people` : ''),
      pri ? 'Why this matters' : 'About this meeting',
      pri?.reasons?.length ? pri.reasons : [ev.preview].filter(Boolean),
      ev.is_online_meeting ? 'From your Microsoft calendar · online meeting' : 'From your Microsoft calendar',
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
      time: [clockTime(ev.start), clockTime(ev.end)].filter(Boolean).join(' – '),
      rail: clockTime(ev.start),
      tone: AGENDA_TONES[i % AGENDA_TONES.length],
      avatars: attendees.length ? attendees : undefined,
    };
  });

  const upcoming =
    brief.meetings.find((m) => (m.starts_in_minutes ?? -1) >= 0) ?? brief.meetings[0];
  const upcomingPri = upcoming
    ? priorityFor(brief.priorities, 'meeting', upcoming.id)
    : undefined;

  /* messages: important email + conversations ---------------------- */
  const emailCards: MessageCard[] = brief.important_emails.map((m: EmailMessage) => {
    const pri = priorityFor(brief.priorities, 'email', m.id);
    const bucket = pri?.bucket ?? (m.importance === 'high' ? 'high' : 'medium');
    const who = m.sender?.name ?? m.sender?.address ?? 'Unknown sender';
    const key = `email:${m.id}`;

    sheets[key] = sheetFrom(
      m.clean_subject || m.subject,
      `${who} · Outlook${m.received_at ? ` · ${clockTime(m.received_at)}` : ''}`,
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
      meta: `${who} · Outlook${m.received_at ? ` · ${clockTime(m.received_at)}` : ''}`,
      initials: initialsOf(who),
      avatar: BUCKET_VIVID[bucket],
      priority: { label: BUCKET_LABEL[bucket], tone: BUCKET_TONE[bucket] },
      deadline: m.is_flagged ? 'Flagged' : !m.is_read ? 'Unread' : 'Read',
      progress: pri ? Math.min(1, Math.max(0.08, pri.score / 100)) : 0.4,
      bar: BUCKET_VIVID[bucket],
      suggestion: pri?.action_hint ?? undefined,
      channel: 'Outlook',
      urgent: bucket === 'critical' || bucket === 'high',
    };
  });

  const chatCards: MessageCard[] = brief.important_conversations.map((c: Conversation) => {
    const pri = priorityFor(brief.priorities, 'chat', c.id);
    const bucket = pri?.bucket ?? (c.waiting_on_me ? 'high' : 'medium');
    const who = c.last_message_from?.name ?? c.display_name;
    const key = `chat:${c.id}`;

    sheets[key] = sheetFrom(
      c.display_name || c.topic || 'Conversation',
      `${who} · Teams${c.last_activity_at ? ` · ${clockTime(c.last_activity_at)}` : ''}`,
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
      title: c.display_name || c.topic || 'Conversation',
      meta: `${who} · Teams${c.last_activity_at ? ` · ${clockTime(c.last_activity_at)}` : ''}`,
      initials: initialsOf(who),
      avatar: BUCKET_VIVID[bucket],
      priority: { label: BUCKET_LABEL[bucket], tone: BUCKET_TONE[bucket] },
      deadline: c.waiting_on_me ? 'Waiting on you' : c.mentions_me ? 'You were mentioned' : 'Unread',
      progress: pri ? Math.min(1, Math.max(0.08, pri.score / 100)) : 0.4,
      bar: BUCKET_VIVID[bucket],
      suggestion: pri?.action_hint ?? undefined,
      channel: 'Teams',
      urgent: bucket === 'critical' || bucket === 'high',
    };
  });

  const messages = [...emailCards, ...chatCards];

  /* tasks ---------------------------------------------------------- */
  const TASK_BARS: Vivid[] = ['vividTeal', 'vividRose', 'vividPeri', 'vividAmber'];
  const tasks: TaskCard[] = brief.pending_tasks.map((t: TaskItem, i) => {
    const pri = priorityFor(brief.priorities, 'task', t.id);
    const bar = t.is_overdue ? 'vividRose' : TASK_BARS[i % TASK_BARS.length];
    const due = t.is_overdue
      ? 'Overdue'
      : t.due_at
        ? `Due ${clockTime(t.due_at)}`
        : 'No due date';

    sheets[`task:${t.id}`] = sheetFrom(
      t.title,
      `${due}${t.list_name ? ` · ${t.list_name}` : ''}`,
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
      meta: `${due}${t.list_name ? ` · ${t.list_name}` : ''}`,
      owner: { initials: initialsOf(p.display_name, 'ME'), bg: bar },
      bar,
      category: t.list_name ?? 'Other',
      percent: t.percent_complete ?? 0,
    };
  });

  const taskCategories = Array.from(new Set(tasks.map((t) => t.category))).slice(0, 6);

  /* home summary --------------------------------------------------- */
  const goFor = (src: PriorityItem['source']): SummaryRow['go'] =>
    src === 'meeting' ? 'Calendar' : src === 'task' ? 'Tasks' : 'Chats';

  const summaryRows: SummaryRow[] = brief.priorities.slice(0, 3).map((item) => ({
    dot: BUCKET_VIVID[item.bucket],
    go: goFor(item.source),
    parts: [
      { text: item.title, strong: true },
      { text: item.reasons[0] ? ` — ${item.reasons[0]}` : item.snippet ? ` — ${item.snippet}` : '' },
    ],
  }));

  /* reminders sheet ------------------------------------------------ */
  const reminders = brief.priorities.slice(0, 3).map((item) => ({
    icon: (item.source === 'meeting'
      ? 'clock'
      : item.source === 'task'
        ? 'doc'
        : 'warnTriangle') as 'warnTriangle' | 'clock' | 'doc',
    tone: (item.bucket === 'critical' || item.bucket === 'high'
      ? 'rose'
      : item.source === 'meeting'
        ? 'teal'
        : 'peri') as 'rose' | 'teal' | 'peri',
    title: item.title,
    meta:
      item.reasons[0] ??
      item.subtitle ??
      `${item.source} · ${BUCKET_LABEL[item.bucket].toLowerCase()}`,
  }));

  /* profile -------------------------------------------------------- */
  const SOURCE_SCOPES: { name: string; scope: string }[] = [
    { name: 'Outlook', scope: 'Mail.Read' },
    { name: 'Teams', scope: 'Chat.Read' },
    { name: 'Calendar', scope: 'Calendars.Read' },
    { name: 'To Do', scope: 'Tasks.ReadWrite' },
    { name: 'Profile', scope: 'User.Read' },
  ];
  const missing = new Set((session?.missing_scopes ?? []).map((x) => x.toLowerCase()));
  const sources = SOURCE_SCOPES.map((x) => ({
    name: x.name,
    connected: !missing.has(x.scope.toLowerCase()),
  }));

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
    summaryRows,
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
    taskCategories,
    priorityInsight: brief.narrative ?? brief.headline ?? null,
    stats: [
      { value: String(s.meetings_today), label: 'Meetings', tone: 'teal' },
      { value: String(s.pending_tasks), label: 'Open tasks', tone: 'peri' },
      { value: String(s.overdue_tasks), label: 'Overdue', tone: 'amber' },
    ],
    sources,
    reminders,
    sheets,
    warnings: brief.warnings ?? [],
  };
}
