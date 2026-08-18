/**
 * Response types mirroring the FastAPI backend's OpenAPI schema
 * (`app/schemas/*`). Only the fields this client actually reads are declared.
 */

export type SourceType = 'email' | 'meeting' | 'task' | 'chat';
export type PriorityBucket = 'critical' | 'high' | 'medium' | 'low';
export type TaskSource = 'todo' | 'planner';

export type Person = { name: string | null; address: string | null };

/** `app.schemas.common.Collection` — the envelope every list endpoint returns. */
export type Collection<T> = {
  items: T[];
  count: number;
  generated_at: string;
  warnings: string[];
};

export type MessageResponse = { message: string; detail?: string | null };

export type HealthStatus = {
  status: string;
  app: string;
  version: string;
  environment: string;
  database?: string | null;
  checked_at: string;
};

export type UserProfile = {
  id: string;
  display_name: string | null;
  given_name: string | null;
  email: string | null;
  job_title: string | null;
  department: string | null;
  timezone: string;
  initials: string | null;
};

export type PriorityItem = {
  id: string;
  source: SourceType;
  source_id: string;
  title: string;
  subtitle: string | null;
  snippet: string;
  actors: Person[];
  occurred_at: string | null;
  due_at: string | null;
  score: number;
  bucket: PriorityBucket;
  rank: number;
  reasons: string[];
  action_hint: string | null;
};

export type Attendee = { name?: string | null; address?: string | null };

export type CalendarEvent = {
  id: string;
  subject: string;
  preview: string;
  start: string | null;
  end: string | null;
  is_all_day: boolean;
  duration_minutes: number | null;
  starts_in_minutes: number | null;
  organizer: Person | null;
  location: string | null;
  is_online_meeting: boolean;
  join_url: string | null;
  attendees: Attendee[];
  attendee_count: number;
  is_recurring: boolean;
  importance: string;
  has_conflict: boolean;
};

export type TaskItem = {
  id: string;
  title: string;
  notes: string;
  list_name: string | null;
  status: string;
  importance: string;
  percent_complete: number;
  is_completed: boolean;
  due_at: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
  has_due_date: boolean;
};

export type EmailMessage = {
  id: string;
  subject: string;
  clean_subject: string;
  preview: string;
  body: string | null;
  sender: Person | null;
  received_at: string | null;
  is_read: boolean;
  importance: string;
  is_flagged: boolean;
  age_hours: number | null;
};

export type ChatParticipant = { name?: string | null };

export type Conversation = {
  id: string;
  topic: string | null;
  chat_type: string;
  last_message_preview: string;
  last_message_from: ChatParticipant | null;
  last_activity_at: string | null;
  participants: ChatParticipant[];
  is_unread: boolean;
  mentions_me: boolean;
  waiting_on_me: boolean;
  age_hours: number | null;
  display_name: string;
};

export type WorkloadStats = {
  meetings_today: number;
  meeting_minutes_today: number;
  meeting_conflicts: number;
  next_meeting_in_minutes: number | null;
  unread_emails: number;
  important_emails: number;
  emails_awaiting_reply: number;
  pending_tasks: number;
  overdue_tasks: number;
  tasks_due_today: number;
  unread_conversations: number;
  conversations_waiting_on_me: number;
  critical_items: number;
  high_priority_items: number;
};

export type TaskSummary = {
  total: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  high_importance: number;
  in_progress: number;
};

export type DailyBrief = {
  generated_at: string;
  timezone: string;
  date: string;
  profile: UserProfile;
  greeting: string;
  headline: string;
  meetings: CalendarEvent[];
  pending_tasks: TaskItem[];
  task_summary: TaskSummary;
  important_emails: EmailMessage[];
  important_conversations: Conversation[];
  priorities: PriorityItem[];
  stats: WorkloadStats;
  narrative: string | null;
  ai_generated: boolean;
  warnings: string[];
};

export type UserSummary = {
  generated_at: string;
  profile: UserProfile;
  greeting: string;
  headline: string;
  highlights: string[];
  recommended_focus: PriorityItem[];
  stats: WorkloadStats;
  narrative: string | null;
  ai_generated: boolean;
  warnings: string[];
};

export type SessionUser = {
  id: string;
  email?: string | null;
  display_name?: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  refresh_token: string;
  user: SessionUser;
};

export type SessionInfo = {
  user: SessionUser;
  session_expires_at: string;
  microsoft_connected: boolean;
  account_type: string;
  missing_scopes: string[];
  unavailable_features: string[];
};

export type LoginUrlResponse = {
  authorization_url: string;
  state: string;
  expires_in: number;
};

/* ── per-source endpoints ─────────────────────────────────────────── */

/** One message inside a Teams conversation (`/chats/{id}/messages`). */
export type ChatMessage = {
  id: string;
  chat_id: string | null;
  created_at: string | null;
  author: ChatParticipant | null;
  content: string;
  importance: string;
  message_type: string;
  from_me: boolean;
  mentions_me: boolean;
  has_attachments: boolean;
  web_url: string | null;
};

export type TaskList = {
  id: string;
  name: string;
  source: TaskSource;
  is_default: boolean;
  is_shared: boolean;
};

export type BucketCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type SourceCounts = {
  email: number;
  meeting: number;
  task: number;
  chat: number;
};

/** `/assistant/priorities` — the Single Unified Priority list. */
export type PriorityList = {
  generated_at: string;
  timezone: string;
  items: PriorityItem[];
  total_considered: number;
  buckets: BucketCounts;
  sources: SourceCounts;
  strategy: string;
  warnings: string[];
};

export type PriorityWeightsView = {
  defaults: Record<string, Record<string, number>>;
  overrides: Record<string, Record<string, number>>;
  effective: Record<string, Record<string, number>>;
};

/* ── user preferences ─────────────────────────────────────────────── */

export type WorkingHours = {
  days_of_week: string[];
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
};

export type MailboxPreferences = {
  timezone: string | null;
  date_format: string | null;
  time_format: string | null;
  language: string | null;
  automatic_replies_status: string | null;
  working_hours: WorkingHours | null;
};

export type UserPreferences = {
  timezone: string;
  vip_contacts: string[];
  priority_weights: Record<string, Record<string, number>>;
};

export type UserPreferencesUpdate = {
  timezone?: string;
  vip_contacts?: string[];
  priority_weights?: Record<string, Record<string, number>>;
};
