/**
 * The shapes the screens render.
 *
 * These sit between the backend DTOs in `api.ts` and the components: one
 * `ViewModel` is built per daily brief (see `services/viewModel.ts`) and every
 * screen reads its slice out of it. Keeping them here rather than beside the
 * builder means a component can type its props without importing the mapper.
 */

import type { VividKey } from '../theme/palette';

/** Palette key naming one of the four saturated accents. */
export type Vivid = VividKey;

/** How urgent something looks: which tag colours it gets. */
export type Tone = 'rose' | 'amber' | 'neutral';

/** Body of a detail bottom sheet, whichever entity opened it. */
export type SheetContent = {
  title: string;
  meta: string;
  kicker: string;
  points: string[];
  source: string;
  hasReply: boolean;
  reply?: string;
  primary: string;
  secondary: string;
  /** Who a sent reply goes to — used in the toast. */
  name?: string;
};

/** Where a Home summary row navigates when tapped. */
export type SummaryTarget = 'Calendar' | 'Tasks' | 'Chats';

export type SummaryRow = {
  dot: Vivid;
  parts: { text: string; strong?: boolean }[];
  go: SummaryTarget;
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

export type WeekDay = { day: string; date: string; active: boolean };

export type NextUp = {
  id: string;
  title: string;
  time: string;
  points: string[];
  cta: string;
};

export type ProfileStat = {
  value: string;
  label: string;
  tone: 'teal' | 'peri' | 'amber';
};

export type ConnectedSource = { name: string; connected: boolean };

export type Reminder = {
  icon: 'warnTriangle' | 'clock' | 'doc';
  tone: 'rose' | 'teal' | 'peri';
  title: string;
  meta: string;
};

export type UserHeader = {
  name: string;
  firstName: string;
  initials: string;
  role: string;
  today: string;
  greeting: string;
};

/** Raw counts; the tiles format them so local edits can adjust the numbers. */
export type GlanceCounts = {
  meetings: number;
  tasks: number;
  urgent: number;
  replies: number;
};

export type ViewModel = {
  user: UserHeader;
  glance: GlanceCounts;
  headline: string;
  summaryRows: SummaryRow[];
  week: WeekDay[];
  nextUp: NextUp | null;
  agenda: AgendaEntry[];
  messages: MessageCard[];
  tasks: TaskCard[];
  taskCategories: string[];
  priorityInsight: string | null;
  stats: ProfileStat[];
  sources: ConnectedSource[];
  reminders: Reminder[];
  sheets: Record<string, SheetContent>;
  warnings: string[];
};
