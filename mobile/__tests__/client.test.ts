/**
 * Every request the app makes to the FastAPI backend, checked against the
 * routes in `app/api/`: path, method, query params and auth header.
 */

jest.mock('react-native', () => ({ NativeModules: {} }));

import { api, ApiError, attachTokenSource } from '../src/api/client';

const BASE = 'http://localhost:8000';

let fetchMock: jest.Mock;

/** Queues one JSON response and returns the fetch call args once used. */
function reply(body: unknown, init: { status?: number } = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  });
}

function lastCall() {
  const [url, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: url as string, opts: (opts ?? {}) as RequestInit };
}

beforeEach(() => {
  fetchMock = jest.fn();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  attachTokenSource({
    getAccessToken: () => 'token-1',
    refresh: jest.fn(async () => 'token-2'),
    onUnauthorized: jest.fn(),
  });
});

describe('unauthenticated endpoints', () => {
  it('GET /health without a bearer token', async () => {
    reply({ status: 'ok' });
    await api.health();
    const { url, opts } = lastCall();
    expect(url).toBe(`${BASE}/health`);
    expect((opts.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('GET /health/ready', async () => {
    reply({ status: 'ok' });
    await api.ready();
    expect(lastCall().url).toBe(`${BASE}/health/ready`);
  });

  it('GET /auth/login asks for JSON and url-encodes the deep link', async () => {
    reply({ authorization_url: 'https://x', state: 's', expires_in: 600 });
    await api.loginUrl('aiassistant://auth');
    expect(lastCall().url).toBe(
      `${BASE}/auth/login?response=json&redirect_uri=aiassistant%3A%2F%2Fauth`,
    );
  });

  it('POST /auth/refresh sends the refresh token unauthenticated', async () => {
    reply({ access_token: 'a', refresh_token: 'r', expires_in: 60 });
    await api.refresh('rt');
    const { url, opts } = lastCall();
    expect(url).toBe(`${BASE}/auth/refresh`);
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ refresh_token: 'rt' }));
    const headers = opts.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('authenticated endpoints', () => {
  it('attaches the bearer token', async () => {
    reply({ user: { id: 'u' } });
    await api.session();
    const { url, opts } = lastCall();
    expect(url).toBe(`${BASE}/auth/session`);
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it.each([
    ['POST /auth/logout', () => api.logout('rt'), `${BASE}/auth/logout`],
    ['GET /users/me', () => api.me(), `${BASE}/api/v1/users/me`],
    ['GET /users/me/mailbox', () => api.mailboxSettings(), `${BASE}/api/v1/users/me/mailbox`],
    ['GET /users/me/preferences', () => api.preferences(), `${BASE}/api/v1/users/me/preferences`],
    ['GET /mail/important', () => api.mail.important(), `${BASE}/api/v1/mail/important`],
    ['GET /mail/messages', () => api.mail.messages(), `${BASE}/api/v1/mail/messages`],
    ['GET /calendar/today', () => api.calendar.today(), `${BASE}/api/v1/calendar/today`],
    ['GET /calendar/events', () => api.calendar.events(), `${BASE}/api/v1/calendar/events`],
    ['GET /chats', () => api.chats.list(), `${BASE}/api/v1/chats`],
    ['GET /chats/important', () => api.chats.important(), `${BASE}/api/v1/chats/important`],
    ['GET /tasks/pending', () => api.tasks.pending(), `${BASE}/api/v1/tasks/pending`],
    ['GET /tasks', () => api.tasks.list(), `${BASE}/api/v1/tasks`],
    ['GET /tasks/lists', () => api.tasks.lists(), `${BASE}/api/v1/tasks/lists`],
    ['GET /tasks/summary', () => api.tasks.summary(), `${BASE}/api/v1/tasks/summary`],
    ['GET /assistant/priorities', () => api.priorities(), `${BASE}/api/v1/assistant/priorities`],
    [
      'GET /assistant/priority-weights',
      () => api.priorityWeights(),
      `${BASE}/api/v1/assistant/priority-weights`,
    ],
  ])('%s', async (_label, call, expected) => {
    reply({ items: [], count: 0 });
    await call();
    expect(lastCall().url).toBe(expected);
  });

  it('sends use_ai=true on the brief and the summary', async () => {
    reply({});
    await api.dailyBrief();
    expect(lastCall().url).toBe(`${BASE}/api/v1/assistant/daily-brief?use_ai=true`);

    reply({});
    await api.summary();
    expect(lastCall().url).toBe(`${BASE}/api/v1/assistant/summary?use_ai=true`);
  });

  it('PATCHes preferences', async () => {
    reply({ timezone: 'Asia/Karachi', vip_contacts: [], priority_weights: {} });
    await api.updatePreferences({ timezone: 'Asia/Karachi' });
    const { url, opts } = lastCall();
    expect(url).toBe(`${BASE}/api/v1/users/me/preferences`);
    expect(opts.method).toBe('PATCH');
    expect(opts.body).toBe(JSON.stringify({ timezone: 'Asia/Karachi' }));
  });
});

describe('query building', () => {
  it('drops undefined params and repeats array params', async () => {
    reply({ items: [] });
    await api.priorities({ limit: 10, sources: ['email', 'chat'] });
    expect(lastCall().url).toBe(
      `${BASE}/api/v1/assistant/priorities?limit=10&sources=email&sources=chat`,
    );
  });

  it('maps camelCase options onto the backend snake_case names', async () => {
    reply({ items: [] });
    await api.mail.messages({ limit: 5, unreadOnly: true, search: 'budget' });
    expect(lastCall().url).toBe(
      `${BASE}/api/v1/mail/messages?limit=5&unread_only=true&search=budget`,
    );

    reply({ items: [] });
    await api.tasks.list({ includeCompleted: true, sources: ['todo'] });
    expect(lastCall().url).toBe(
      `${BASE}/api/v1/tasks?include_completed=true&sources=todo`,
    );
  });

  it('escapes path ids', async () => {
    reply({ items: [] });
    await api.chats.messages('19:abc def@thread.v2', 5);
    expect(lastCall().url).toBe(
      `${BASE}/api/v1/chats/19%3Aabc%20def%40thread.v2/messages?limit=5`,
    );
  });
});

describe('401 handling', () => {
  it('refreshes once and retries', async () => {
    const refresh = jest.fn(async () => 'token-2');
    const onUnauthorized = jest.fn();
    attachTokenSource({ getAccessToken: () => 'stale', refresh, onUnauthorized });

    reply({ detail: 'expired' }, { status: 401 });
    reply({ user: { id: 'u' } });

    await expect(api.session()).resolves.toEqual({ user: { id: 'u' } });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect((lastCall().opts.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-2',
    );
  });

  it('gives up after a second 401', async () => {
    const onUnauthorized = jest.fn();
    attachTokenSource({
      getAccessToken: () => 'stale',
      refresh: jest.fn(async () => 'token-2'),
      onUnauthorized,
    });

    reply({ detail: 'expired' }, { status: 401 });
    reply({ detail: 'expired' }, { status: 401 });

    await expect(api.session()).rejects.toThrow('Your session expired. Sign in again.');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('errors', () => {
  it('surfaces the backend detail string', async () => {
    reply({ detail: 'Calendars.Read has not been granted.' }, { status: 403 });
    await expect(api.calendar.today()).rejects.toThrow(
      'Calendars.Read has not been granted.',
    );
  });

  it('explains an unreachable backend rather than leaking the fetch error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const err = await api.health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toContain('Cannot reach the backend at http://localhost:8000');
    expect(err.message).toContain('adb reverse');
  });
});
