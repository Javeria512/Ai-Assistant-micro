/**
 * `buildViewModel` is the whole contract between the backend and the screens:
 * one daily-brief response in, every rendered slot out. Nothing about it changed
 * in the CLI migration, which is exactly why it is worth asserting — the screens
 * are unchanged only if this mapping is.
 */

import { buildViewModel, initialsOf, relativeMinutes } from '../src/data/adapters';
import type {
  CalendarEvent,
  Conversation,
  DailyBrief,
  EmailMessage,
  PriorityItem,
  SessionInfo,
  TaskItem,
} from '../src/api/types';

const MEETING: CalendarEvent = {
  id: 'ev1',
  subject: 'Quarterly review',
  preview: 'Numbers for Q3.',
  start: '2026-08-05T09:30:00Z',
  end: '2026-08-05T10:15:00Z',
  is_all_day: false,
  duration_minutes: 45,
  starts_in_minutes: 25,
  organizer: { name: 'Dana Cole', address: 'dana@example.com' },
  location: 'Room 4',
  is_online_meeting: true,
  join_url: 'https://teams.microsoft.com/l/x',
  attendees: [
    { name: 'Dana Cole' },
    { name: 'Sam Ortiz' },
    { name: 'Priya Rao' },
    { name: 'Lee Wu' },
  ],
  attendee_count: 6,
  is_recurring: false,
  importance: 'normal',
  has_conflict: false,
};

const TASK: TaskItem = {
  id: 't1',
  title: 'Sign off the budget',
  notes: 'Finance is waiting.',
  list_name: 'Finance',
  status: 'inProgress',
  importance: 'high',
  percent_complete: 40,
  is_completed: false,
  due_at: '2026-08-05T17:00:00Z',
  is_overdue: false,
  days_until_due: 0,
  has_due_date: true,
};

const EMAIL: EmailMessage = {
  id: 'm1',
  subject: 'RE: Contract renewal',
  clean_subject: 'Contract renewal',
  preview: 'Can you confirm by Friday?',
  body: null,
  sender: { name: 'Alex Kim', address: 'alex@example.com' },
  received_at: '2026-08-05T07:05:00Z',
  is_read: false,
  importance: 'high',
  is_flagged: true,
  age_hours: 2,
};

const CHAT: Conversation = {
  id: 'c1',
  topic: 'Launch plan',
  chat_type: 'group',
  last_message_preview: 'Need your call on the date.',
  last_message_from: { name: 'Sam Ortiz' },
  last_activity_at: '2026-08-05T08:10:00Z',
  participants: [{ name: 'Sam Ortiz' }, { name: 'Priya Rao' }],
  is_unread: true,
  mentions_me: false,
  waiting_on_me: true,
  age_hours: 1,
  display_name: 'Launch plan',
};

const priority = (over: Partial<PriorityItem>): PriorityItem => ({
  id: 'p',
  source: 'email',
  source_id: 'm1',
  title: 'Contract renewal',
  subtitle: null,
  snippet: 'Can you confirm by Friday?',
  actors: [],
  occurred_at: null,
  due_at: null,
  score: 88,
  bucket: 'critical',
  rank: 1,
  reasons: ['Sender is a VIP', 'Asks for a decision'],
  action_hint: 'Reply with the renewal date',
  ...over,
});

const BRIEF: DailyBrief = {
  generated_at: '2026-08-05T09:05:00Z',
  timezone: 'Asia/Karachi',
  date: '2026-08-05',
  profile: {
    id: 'u1',
    display_name: 'Javeria Malik',
    given_name: 'Javeria',
    email: 'javeria@example.com',
    job_title: 'Head of Delivery',
    department: 'Engineering',
    timezone: 'Asia/Karachi',
    initials: 'JM',
  },
  greeting: 'Good morning, Javeria',
  headline: 'Two decisions and one meeting need you before noon.',
  meetings: [MEETING],
  pending_tasks: [TASK],
  task_summary: {
    total: 4,
    overdue: 1,
    due_today: 2,
    due_this_week: 3,
    high_importance: 1,
    in_progress: 1,
  },
  important_emails: [EMAIL],
  important_conversations: [CHAT],
  priorities: [
    priority({}),
    priority({ id: 'p2', source: 'meeting', source_id: 'ev1', bucket: 'high', rank: 2, title: 'Quarterly review', reasons: ['Starts in 25 minutes'] }),
    priority({ id: 'p3', source: 'task', source_id: 't1', bucket: 'medium', rank: 3, title: 'Sign off the budget', reasons: ['Due today'] }),
  ],
  stats: {
    meetings_today: 1,
    meeting_minutes_today: 45,
    meeting_conflicts: 0,
    next_meeting_in_minutes: 25,
    unread_emails: 9,
    important_emails: 1,
    emails_awaiting_reply: 2,
    pending_tasks: 4,
    overdue_tasks: 1,
    tasks_due_today: 2,
    unread_conversations: 3,
    conversations_waiting_on_me: 1,
    critical_items: 1,
    high_priority_items: 1,
  },
  narrative: 'Clear the contract reply first, then join the review.',
  ai_generated: true,
  warnings: ['Planner was unavailable.'],
};

const SESSION: SessionInfo = {
  user: { id: 'u1', email: 'javeria@example.com', display_name: 'Javeria Malik' },
  session_expires_at: '2026-08-05T18:00:00Z',
  microsoft_connected: true,
  account_type: 'work',
  missing_scopes: ['Tasks.ReadWrite'],
  unavailable_features: ['task write-back'],
};

describe('buildViewModel', () => {
  const vm = buildViewModel(BRIEF, SESSION);

  it('maps the signed-in user onto the profile hero', () => {
    expect(vm.user).toMatchObject({
      name: 'Javeria Malik',
      firstName: 'Javeria',
      initials: 'JM',
      role: 'Head of Delivery · Engineering',
      greeting: 'Good morning, Javeria',
    });
  });

  it('feeds the glance tiles from the workload stats', () => {
    expect(vm.glance).toEqual({
      meetings: 1,
      tasks: 4,
      // critical_items + high_priority_items
      urgent: 2,
      // conversations_waiting_on_me + emails_awaiting_reply
      replies: 3,
    });
  });

  it('builds an agenda entry per meeting, with an overflow avatar', () => {
    expect(vm.agenda).toHaveLength(1);
    const [entry] = vm.agenda;
    expect(entry).toMatchObject({ id: 'ev1', title: 'Quarterly review', subtitle: 'Room 4' });
    // Three attendees shown, then "+3" for the remaining of attendee_count 6.
    expect(entry.avatars?.map((a) => a.label)).toEqual(['DC', 'SO', 'PR', '+3']);
  });

  it('offers the join CTA when the meeting is online', () => {
    expect(vm.nextUp).toMatchObject({
      id: 'ev1',
      title: 'Quarterly review',
      cta: 'Join meeting',
      points: ['Starts in 25 minutes'],
    });
    expect(vm.nextUp!.time).toContain('in 25 minutes');
  });

  it('colour-codes messages by priority bucket', () => {
    const email = vm.messages.find((m) => m.id === 'email:m1')!;
    expect(email).toMatchObject({
      title: 'Contract renewal',
      channel: 'Outlook',
      avatar: 'vividRose', // critical
      urgent: true,
      deadline: 'Flagged',
      suggestion: 'Reply with the renewal date',
    });
    expect(email.priority).toEqual({ label: 'Critical', tone: 'rose' });
    expect(email.meta).toContain('Alex Kim · Outlook');
  });

  it('carries Teams conversations alongside email', () => {
    const chat = vm.messages.find((m) => m.id === 'chat:c1')!;
    expect(chat).toMatchObject({ channel: 'Teams', deadline: 'Waiting on you' });
    expect(chat.meta).toContain('Sam Ortiz · Teams');
  });

  it('maps tasks with their list as the filter category', () => {
    expect(vm.tasks).toHaveLength(1);
    expect(vm.tasks[0]).toMatchObject({
      id: 't1',
      title: 'Sign off the budget',
      category: 'Finance',
      percent: 40,
    });
    expect(vm.tasks[0].meta).toContain('Finance');
    expect(vm.taskCategories).toEqual(['Finance']);
  });

  it('opens a detail sheet for every entity, keyed the way the store expects', () => {
    expect(Object.keys(vm.sheets).sort()).toEqual([
      'chat:c1',
      'email:m1',
      'meeting:ev1',
      'task:t1',
    ]);
    expect(vm.sheets['email:m1']).toMatchObject({
      title: 'Contract renewal',
      primary: 'Open in Outlook',
      secondary: 'Later',
      hasReply: true,
      name: 'Alex Kim',
      points: ['Sender is a VIP', 'Asks for a decision'],
    });
    expect(vm.sheets['meeting:ev1'].primary).toBe('Join');
  });

  it('derives connected sources from the granted Graph scopes', () => {
    // SESSION is missing Tasks.ReadWrite, so only To Do should read disconnected.
    expect(vm.sources).toEqual([
      { name: 'Outlook', connected: true },
      { name: 'Teams', connected: true },
      { name: 'Calendar', connected: true },
      { name: 'To Do', connected: false },
      { name: 'Profile', connected: true },
    ]);
  });

  it('treats every source as connected when the session cannot be read', () => {
    expect(buildViewModel(BRIEF, null).sources.every((s) => s.connected)).toBe(true);
  });

  it('shows the top three priorities as the home summary and the alerts sheet', () => {
    expect(vm.summaryRows).toHaveLength(3);
    expect(vm.summaryRows.map((r) => r.go)).toEqual(['Chats', 'Calendar', 'Tasks']);
    expect(vm.summaryRows[0].parts[0]).toEqual({ text: 'Contract renewal', strong: true });
    expect(vm.reminders.map((r) => r.icon)).toEqual(['warnTriangle', 'clock', 'doc']);
  });

  it('passes the AI narrative and per-source warnings straight through', () => {
    expect(vm.priorityInsight).toBe('Clear the contract reply first, then join the review.');
    expect(vm.warnings).toEqual(['Planner was unavailable.']);
    expect(vm.headline).toBe('Two decisions and one meeting need you before noon.');
  });

  it('reports real counters on the profile stats, not invented metrics', () => {
    expect(vm.stats).toEqual([
      { value: '1', label: 'Meetings', tone: 'teal' },
      { value: '4', label: 'Open tasks', tone: 'peri' },
      { value: '1', label: 'Overdue', tone: 'amber' },
    ]);
  });

  it('renders a five-day, Monday-anchored week strip', () => {
    expect(vm.week).toHaveLength(5);
    expect(vm.week.filter((d) => d.active)).toHaveLength(1);
  });

  it('survives an account with nothing in it', () => {
    const empty = buildViewModel(
      {
        ...BRIEF,
        meetings: [],
        pending_tasks: [],
        important_emails: [],
        important_conversations: [],
        priorities: [],
        narrative: null,
        warnings: [],
      },
      SESSION,
    );
    expect(empty.agenda).toEqual([]);
    expect(empty.messages).toEqual([]);
    expect(empty.tasks).toEqual([]);
    expect(empty.nextUp).toBeNull();
    expect(empty.sheets).toEqual({});
    expect(empty.summaryRows).toEqual([]);
  });
});

describe('formatters', () => {
  it('phrases the countdown to the next meeting', () => {
    expect(relativeMinutes(0)).toBe('now');
    expect(relativeMinutes(1)).toBe('in 1 minute');
    expect(relativeMinutes(25)).toBe('in 25 minutes');
    expect(relativeMinutes(90)).toBe('in 2 hours');
    expect(relativeMinutes(-5)).toBe('started');
    expect(relativeMinutes(null)).toBe('');
  });

  it('builds avatar initials from whatever the directory returned', () => {
    expect(initialsOf('Javeria Malik')).toBe('JM');
    expect(initialsOf('Prince')).toBe('PR');
    expect(initialsOf('Ada Byron Lovelace')).toBe('AL');
    expect(initialsOf(null)).toBe('?');
    expect(initialsOf(undefined, 'ME')).toBe('ME');
  });
});
