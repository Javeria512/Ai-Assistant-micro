import { NativeModules } from 'react-native';
import { API_URL } from '@env';
import { AUTH_REDIRECT } from '../constants/app';

/**
 * Where the FastAPI backend lives.
 *
 * On a USB-attached device `adb reverse tcp:8000 tcp:8000` maps the phone's own
 * localhost:8000 onto the dev machine, so `localhost` is correct there. Over
 * Wi-Fi there is no tunnel, so fall back to whichever host served the JS
 * bundle — that is the dev machine's LAN address (or 10.0.2.2 on an emulator).
 *
 * Set API_URL to override either way — in `mobile/.env`, or in Metro's own
 * environment (`API_URL=http://… npm start`); the babel plugin reads the file
 * first and falls back to the shell. Both are resolved when the bundle is
 * built, so a change needs a Metro restart with `--reset-cache`.
 */

/** Port the backend listens on when nothing overrides `API_URL`. */
const DEFAULT_PORT = 8000;

/**
 * Host that served the JS bundle. This is the React Native CLI equivalent of
 * `Constants.expoConfig.hostUri`: the dev server writes its own address into
 * the bundle URL, so `SourceCode.scriptURL` carries it. In a release build the
 * bundle is a `file://` asset with no host, and this returns undefined.
 */
function bundleHost(): string | undefined {
  let url: unknown;
  try {
    // Bridgeless exposes SourceCode through the TurboModule proxy, where the
    // constants may only be reachable via getConstants(). Either shape is fine;
    // this runs at module load, so it must not be allowed to throw.
    const source = (NativeModules as Record<string, any> | undefined)?.SourceCode;
    url = source?.scriptURL ?? source?.getConstants?.()?.scriptURL;
  } catch {
    return undefined;
  }
  if (typeof url !== 'string') return undefined;

  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(url);
  return match?.[1];
}

function inferBaseUrl(): string {
  if (API_URL) return API_URL.replace(/\/$/, '');

  const host = bundleHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL = inferBaseUrl();

/** Re-exported so the API layer stays the one place a caller reaches for it. */
export { AUTH_REDIRECT };
