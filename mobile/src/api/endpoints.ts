/**
 * Every endpoint the FastAPI backend exposes, grouped the way the routers are.
 *
 * The dashboard only needs `dailyBrief` (which fans out server-side), but the
 * per-source readers are here so any screen can drill in without reaching
 * around the client.
 */

import { ApiError, describeError, parseBody, qs, raw, request } from './client';
import type {
  CalendarEvent,
  ChatMessage,
  Collection,
  Conversation,
  DailyBrief,
  EmailMessage,
  HealthStatus,
  LoginUrlResponse,
  MailboxPreferences,
  MessageResponse,
  PriorityList,
  PriorityWeightsView,
  SessionInfo,
  SourceType,
  TaskItem,
  TaskList,
  TaskSource,
  TaskSummary,
  TokenResponse,
  UserPreferences,
  UserPreferencesUpdate,
  UserProfile,
  UserSummary,
} from '../models/api';

export const api = {
  /* ── health ────────────────────────────────────────────────────── */

  health: () => request<HealthStatus>('/health', {}, false),

  ready: () => request<HealthStatus>('/health/ready', {}, false),

  /* ── auth ──────────────────────────────────────────────────────── */

  /** Builds the Microsoft authorization URL for the given deep link. */
  loginUrl: (redirectUri: string) =>
    request<LoginUrlResponse>(
      `/auth/login${qs({ response: 'json', redirect_uri: redirectUri })}`,
      {},
      false,
    ),

  refresh: (refreshToken: string) =>
    request<TokenResponse>(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
      false,
    ),

  logout: (refreshToken?: string) =>
    request<MessageResponse>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
    }),

  session: () => request<SessionInfo>('/auth/session'),

  /* ── user ──────────────────────────────────────────────────────── */

  me: () => request<UserProfile>('/api/v1/users/me'),

  /**
   * The photo endpoint answers 204 when the account has none, so this resolves
   * to null rather than throwing. Returns a data URI ready for `<Image>`.
   */
  myPhoto: async (): Promise<string | null> => {
    const res = await raw('/api/v1/users/me/photo');
    if (res.status === 204) return null;
    if (!res.ok) {
      throw new ApiError(describeError(res.status, await parseBody(res)), res.status);
    }

    const blob = await res.blob();
    return new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new ApiError('Could not read the photo.', 0));
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(blob);
    });
  },

  mailboxSettings: () => request<MailboxPreferences>('/api/v1/users/me/mailbox'),

  preferences: () => request<UserPreferences>('/api/v1/users/me/preferences'),

  updatePreferences: (payload: UserPreferencesUpdate) =>
    request<UserPreferences>('/api/v1/users/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /* ── mail ──────────────────────────────────────────────────────── */

  mail: {
    messages: (
      opts: {
        limit?: number;
        folder?: string;
        unreadOnly?: boolean;
        search?: string;
      } = {},
    ) =>
      request<Collection<EmailMessage>>(
        `/api/v1/mail/messages${qs({
          limit: opts.limit,
          folder: opts.folder,
          unread_only: opts.unreadOnly,
          search: opts.search,
        })}`,
      ),

    important: (limit?: number) =>
      request<Collection<EmailMessage>>(`/api/v1/mail/important${qs({ limit })}`),

    message: (messageId: string) =>
      request<EmailMessage>(`/api/v1/mail/messages/${encodeURIComponent(messageId)}`),
  },

  /* ── calendar ──────────────────────────────────────────────────── */

  calendar: {
    today: () => request<Collection<CalendarEvent>>('/api/v1/calendar/today'),

    events: (
      opts: {
        start?: string;
        end?: string;
        limit?: number;
        includeDeclined?: boolean;
      } = {},
    ) =>
      request<Collection<CalendarEvent>>(
        `/api/v1/calendar/events${qs({
          start: opts.start,
          end: opts.end,
          limit: opts.limit,
          include_declined: opts.includeDeclined,
        })}`,
      ),

    conflicts: (days?: number) =>
      request<Collection<CalendarEvent>>(`/api/v1/calendar/conflicts${qs({ days })}`),
  },

  /* ── chats (Teams) ─────────────────────────────────────────────── */

  chats: {
    list: (limit?: number) =>
      request<Collection<Conversation>>(`/api/v1/chats${qs({ limit })}`),

    important: (limit?: number) =>
      request<Collection<Conversation>>(`/api/v1/chats/important${qs({ limit })}`),

    messages: (chatId: string, limit?: number) =>
      request<Collection<ChatMessage>>(
        `/api/v1/chats/${encodeURIComponent(chatId)}/messages${qs({ limit })}`,
      ),
  },

  /* ── tasks ─────────────────────────────────────────────────────── */

  tasks: {
    pending: (limit?: number) =>
      request<Collection<TaskItem>>(`/api/v1/tasks/pending${qs({ limit })}`),

    list: (opts: { includeCompleted?: boolean; sources?: TaskSource[] } = {}) =>
      request<Collection<TaskItem>>(
        `/api/v1/tasks${qs({
          include_completed: opts.includeCompleted,
          sources: opts.sources,
        })}`,
      ),

    lists: () => request<Collection<TaskList>>('/api/v1/tasks/lists'),

    summary: () => request<TaskSummary>('/api/v1/tasks/summary'),
  },

  /* ── assistant ─────────────────────────────────────────────────── */

  priorities: (opts: { limit?: number; sources?: SourceType[]; useAi?: boolean } = {}) =>
    request<PriorityList>(
      `/api/v1/assistant/priorities${qs({
        limit: opts.limit,
        sources: opts.sources,
        use_ai: opts.useAi,
      })}`,
    ),

  dailyBrief: (useAi = true) =>
    request<DailyBrief>(`/api/v1/assistant/daily-brief${qs({ use_ai: useAi })}`),

  summary: (useAi = true) =>
    request<UserSummary>(`/api/v1/assistant/summary${qs({ use_ai: useAi })}`),

  priorityWeights: () =>
    request<PriorityWeightsView>('/api/v1/assistant/priority-weights'),
};

export type Api = typeof api;
