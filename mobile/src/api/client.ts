/**
 * HTTP transport for the FastAPI backend: error shape, auth-token plumbing,
 * one-shot refresh-and-retry, and query-string building.
 *
 * The routes themselves live in `endpoints.ts`; nothing here knows what a
 * "daily brief" is.
 */

import { API_BASE_URL } from './config';

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

/** Turns whatever the backend returned into a sentence worth showing a user. */
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
export async function raw(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<Response> {
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

export async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const res = await raw(path, init, auth);
  const body = await parseBody(res);
  if (!res.ok) throw new ApiError(describe(res.status, body), res.status, body);
  return body as T;
}

/** Reads a response body for error reporting outside `request`. */
export { describe as describeError, parseBody };

/** Builds `?a=1&b=2`, dropping undefined/null and repeating array params. */
export function qs(params: Record<string, unknown>): string {
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
