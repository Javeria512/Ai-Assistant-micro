import { API_BASE_URL } from './config';
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
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Supplies the current access token and refreshes it when the API rejects one. */
export type TokenSource = {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  onUnauthorized: () => void;
};

let tokens: TokenSource | null = null;
export function attachTokenSource(source: TokenSource) {
  tokens = source;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describe(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === 'string') return d;
  }
  if (typeof body === 'string' && body.length < 200) return body;
  return `Request failed (${status})`;
}

async function send(path: string, init: RequestInit, token: string | null) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : null),
      ...(token ? { Authorization: `Bearer ${token}` } : null),
      ...init.headers,
    },
  });
}

/**
 * Performs a request, and on a 401 makes exactly one attempt to rotate the
 * session before retrying. A second 401 means the session is genuinely gone.
 */
async function raw(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  let res: Response;
  try {
    res = await send(path, init, auth ? (tokens?.getAccessToken() ?? null) : null);
  } catch (e) {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE_URL}. Is it running, and is 'adb reverse tcp:8000 tcp:8000' set?`,
      0,
      e,
    );
  }

  if (res.status === 401 && auth && tokens) {
    const fresh = await tokens.refresh();
    if (fresh) {
      res = await send(path, init, fresh);
    }
    if (res.status === 401) {
      tokens.onUnauthorized();
      throw new ApiError('Your session expired. Sign in again.', 401);
    }
  }

  return res;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const res = await raw(path, init, auth);
  const body = await parseBody(res);
  if (!res.ok) throw new ApiError(describe(res.status, body), res.status, body);
  return body as T;
}

/** Builds `?a=1&b=2`, dropping undefined/null and repeating array params. */
function qs(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const list = Array.isArray(value) ? value : [value];
    for (const v of list) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Every endpoint the FastAPI backend exposes, grouped the way the routers are.
 * The dashboard only needs `assistant.dailyBrief` (which fans out server-side),
 * but the per-source readers are here so any screen can drill in without
 * reaching around the client.
 */
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
    if (!res.ok) throw new ApiError(describe(res.status, await parseBody(res)), res.status);

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
    messages: (opts: {
      limit?: number;
      folder?: string;
      unreadOnly?: boolean;
      search?: string;
    } = {}) =>
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

    events: (opts: {
      start?: string;
      end?: string;
      limit?: number;
      includeDeclined?: boolean;
    } = {}) =>
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
