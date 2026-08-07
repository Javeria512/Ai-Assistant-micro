import { AppState, Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { api } from '../api/client';
import { AUTH_REDIRECT } from '../api/config';
import type { SessionUser, TokenResponse } from '../api/types';

/**
 * Keychain entries are addressed by service rather than by key, so the old
 * SecureStore key becomes the service name. `username` is unused — the whole
 * session rides in the (encrypted) password field.
 */
const SERVICE = 'ai-assistant.session';
const ACCOUNT = 'session';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  user: SessionUser | null;
};

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const stored = await Keychain.getGenericPassword({ service: SERVICE });
    return stored ? (JSON.parse(stored.password) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: StoredSession): Promise<void> {
  await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(s), {
    service: SERVICE,
    // Tokens must survive a cold start without the user unlocking anything,
    // which is the guarantee SecureStore gave by default.
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearSession(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // Nothing stored — already clear.
  }
}

export function toSession(t: TokenResponse): StoredSession {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    user: t.user ?? null,
  };
}

/**
 * The backend redirects to `aiassistant://auth#access_token=…&refresh_token=…`.
 * Tokens ride in the URL *fragment* so they never reach a server or an access
 * log — which also means they are not query params, hence the manual split.
 */
export function parseAuthDeepLink(url: string): StoredSession | null {
  const hash = url.split('#')[1];
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const expiresIn = Number(params.get('expires_in') ?? 3600);
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    user: null,
  };
}

export class AuthCancelled extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'AuthCancelled';
  }
}

/** Grace period for the deep link to land after the app is foregrounded again. */
const RETURN_GRACE_MS = 700;

/**
 * Opens the authorization URL in the system browser and resolves with the
 * deep link it eventually bounces back to.
 *
 * Only used when no Custom Tabs / SFSafariViewController provider is installed;
 * `InAppBrowser.openAuth` is the normal path because it keeps the browser
 * inside our own task, the way `WebBrowser.openAuthSessionAsync` did.
 *
 * A plain `Linking.openURL` has no completion callback, so backing out of the
 * browser is inferred: the app becoming active again without a redirect having
 * arrived is a cancellation. Without that, the promise would never settle and
 * the sign-in button would stay disabled for the rest of the session.
 */
async function openAuthViaSystemBrowser(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (grace) clearTimeout(grace);
      linkSub.remove();
      appStateSub.remove();
      fn();
    };

    const linkSub = Linking.addEventListener('url', ({ url: incoming }) => {
      if (!incoming.startsWith(AUTH_REDIRECT)) return;
      finish(() => resolve(incoming));
    });

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || settled) return;
      // The redirect can be delivered just after the resume, so give it a beat
      // before calling this a cancellation.
      if (grace) clearTimeout(grace);
      grace = setTimeout(() => finish(() => reject(new AuthCancelled())), RETURN_GRACE_MS);
    });

    Linking.openURL(url).catch((e) => finish(() => reject(e)));
  });
}

/**
 * Runs the whole Microsoft sign-in in an in-app browser tab and returns the
 * session the backend hands back.
 *
 * The backend owns the OAuth exchange (PKCE, state, the client secret); the app
 * only opens the URL it is given and reads the tokens off the return deep link.
 */
export async function signInWithMicrosoft(): Promise<StoredSession> {
  const { authorization_url } = await api.loginUrl(AUTH_REDIRECT);

  let redirected: string;
  if (await InAppBrowser.isAvailable()) {
    const result = await InAppBrowser.openAuth(authorization_url, AUTH_REDIRECT, {
      showInRecents: true,
    });
    if (result.type !== 'success' || !result.url) throw new AuthCancelled();
    redirected = result.url;
  } else {
    redirected = await openAuthViaSystemBrowser(authorization_url);
  }

  const session = parseAuthDeepLink(redirected);
  if (!session) {
    const err = new URLSearchParams(redirected.split('#')[1] ?? '').get('error');
    throw new Error(err ?? 'Sign-in did not return a session.');
  }
  return session;
}
