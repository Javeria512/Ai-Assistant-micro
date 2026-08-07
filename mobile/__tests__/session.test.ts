/**
 * Session storage moved from `expo-secure-store` to `react-native-keychain`,
 * and the auth browser from `expo-web-browser` to
 * `react-native-inappbrowser-reborn`. These cover both swaps plus the deep-link
 * parsing that is unchanged but load-bearing.
 *
 * The factories have to be self-contained: the ESM→CJS transform hoists the
 * `import` of session.ts above any `const` in this file, so a factory that
 * closed over one would read it before initialisation.
 */

jest.mock('react-native-keychain', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    store,
    getGenericPassword: jest.fn(async ({ service }: { service: string }) => {
      const password = store.get(service);
      return password ? { username: 'session', password, service, storage: 'test' } : false;
    }),
    setGenericPassword: jest.fn(
      async (_user: string, password: string, { service }: { service: string }) => {
        store.set(service, password);
        return true;
      },
    ),
    resetGenericPassword: jest.fn(async ({ service }: { service: string }) => {
      store.delete(service);
      return true;
    }),
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly' },
  };
});

jest.mock('react-native-inappbrowser-reborn', () => ({
  __esModule: true,
  InAppBrowser: {
    isAvailable: jest.fn(async () => true),
    openAuth: jest.fn(async () => ({ type: 'success', url: '' })),
  },
}));

jest.mock('../src/api/client', () => ({
  __esModule: true,
  api: {
    loginUrl: jest.fn(async () => ({
      authorization_url: 'https://login.microsoftonline.com/x',
    })),
  },
}));

import {
  AuthCancelled,
  clearSession,
  loadSession,
  parseAuthDeepLink,
  saveSession,
  signInWithMicrosoft,
  toSession,
} from '../src/auth/session';
import { api } from '../src/api/client';

const mockKeychain = jest.requireMock('react-native-keychain') as {
  store: Map<string, string>;
  getGenericPassword: jest.Mock;
  setGenericPassword: jest.Mock;
  resetGenericPassword: jest.Mock;
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: string };
};
const { InAppBrowser: mockBrowser } = jest.requireMock(
  'react-native-inappbrowser-reborn',
) as { InAppBrowser: { isAvailable: jest.Mock; openAuth: jest.Mock } };

const SESSION = {
  accessToken: 'at',
  refreshToken: 'rt',
  expiresAt: 1_700_000_000_000,
  user: { id: 'u1', email: 'a@b.c', display_name: 'A B' },
};

beforeEach(() => {
  mockKeychain.store.clear();
  jest.clearAllMocks();
  mockBrowser.isAvailable.mockResolvedValue(true);
});

describe('keychain-backed session storage', () => {
  it('round-trips a session', async () => {
    await saveSession(SESSION);
    await expect(loadSession()).resolves.toEqual(SESSION);
  });

  it('stores under one service, not the account name', async () => {
    await saveSession(SESSION);
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      'session',
      JSON.stringify(SESSION),
      expect.objectContaining({ service: 'ai-assistant.session' }),
    );
  });

  it('keeps tokens readable after a cold start without an unlock', async () => {
    await saveSession(SESSION);
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        accessible: mockKeychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      }),
    );
  });

  it('resolves null rather than throwing when nothing is stored', async () => {
    await expect(loadSession()).resolves.toBeNull();
  });

  it('resolves null when the keychain read fails', async () => {
    mockKeychain.getGenericPassword.mockRejectedValueOnce(new Error('locked'));
    await expect(loadSession()).resolves.toBeNull();
  });

  it('clears the entry on sign-out', async () => {
    await saveSession(SESSION);
    await clearSession();
    await expect(loadSession()).resolves.toBeNull();
  });
});

describe('parseAuthDeepLink', () => {
  it('reads tokens out of the URL fragment', () => {
    const parsed = parseAuthDeepLink(
      'aiassistant://auth#access_token=abc&refresh_token=def&expires_in=60&token_type=bearer',
    );
    expect(parsed).toMatchObject({ accessToken: 'abc', refreshToken: 'def' });
    // 60s out, allowing for the clock advancing between call and assertion.
    expect(parsed!.expiresAt - Date.now()).toBeGreaterThan(58_000);
    expect(parsed!.expiresAt - Date.now()).toBeLessThanOrEqual(60_000);
  });

  it('rejects a link with no fragment or no tokens', () => {
    expect(parseAuthDeepLink('aiassistant://auth')).toBeNull();
    expect(parseAuthDeepLink('aiassistant://auth#error=access_denied')).toBeNull();
    expect(parseAuthDeepLink('aiassistant://auth#access_token=only')).toBeNull();
  });

  it('ignores query params, since tokens ride in the fragment', () => {
    expect(
      parseAuthDeepLink('aiassistant://auth?access_token=abc&refresh_token=d'),
    ).toBeNull();
  });
});

describe('toSession', () => {
  it('turns the backend TokenResponse into an absolute expiry', () => {
    const before = Date.now();
    const s = toSession({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: '2026-01-01T00:00:00Z',
      user: { id: 'u1' },
    });
    expect(s.accessToken).toBe('a');
    expect(s.refreshToken).toBe('r');
    expect(s.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000);
  });
});

describe('signInWithMicrosoft', () => {
  it('opens the backend-built URL and returns the session from the deep link', async () => {
    mockBrowser.openAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'aiassistant://auth#access_token=abc&refresh_token=def&expires_in=3600',
    });

    await expect(signInWithMicrosoft()).resolves.toMatchObject({
      accessToken: 'abc',
      refreshToken: 'def',
    });

    expect(api.loginUrl).toHaveBeenCalledWith('aiassistant://auth');
    expect(mockBrowser.openAuth).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/x',
      'aiassistant://auth',
      { showInRecents: true },
    );
  });

  it('treats a dismissed browser tab as a cancellation', async () => {
    mockBrowser.openAuth.mockResolvedValueOnce({ type: 'cancel' });
    await expect(signInWithMicrosoft()).rejects.toThrow(AuthCancelled);
  });

  it('surfaces the error the backend put in the fragment', async () => {
    mockBrowser.openAuth.mockResolvedValueOnce({
      type: 'success',
      url: 'aiassistant://auth#error=consent_required',
    });
    await expect(signInWithMicrosoft()).rejects.toThrow('consent_required');
  });
});
