/**
 * The base-URL inference replaced `expo-constants`' `hostUri` with the bundle
 * URL React Native's SourceCode module reports, so the substitution is worth
 * pinning down: same rules, different source.
 */

function loadConfig(scriptURL: string | undefined) {
  let mod: typeof import('../src/api/config');
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      NativeModules: scriptURL === undefined ? {} : { SourceCode: { scriptURL } },
    }));
    mod = require('../src/api/config');
  });
  return mod!;
}

describe('API_BASE_URL', () => {
  it('uses the LAN host that served the bundle', () => {
    expect(loadConfig('http://192.168.1.20:8081/index.bundle?platform=android')
      .API_BASE_URL).toBe('http://192.168.1.20:8000');
  });

  it('uses the emulator loopback alias when Metro is reached through it', () => {
    expect(loadConfig('http://10.0.2.2:8081/index.bundle').API_BASE_URL).toBe(
      'http://10.0.2.2:8000',
    );
  });

  it('falls back to localhost when adb reverse is tunnelling Metro', () => {
    // `adb reverse tcp:8000 tcp:8000` is what makes this correct on a device.
    expect(loadConfig('http://localhost:8081/index.bundle').API_BASE_URL).toBe(
      'http://localhost:8000',
    );
    expect(loadConfig('http://127.0.0.1:8081/index.bundle').API_BASE_URL).toBe(
      'http://localhost:8000',
    );
  });

  it('falls back to localhost for a release bundle, which has no host', () => {
    expect(loadConfig('file:///data/app/base.apk!/assets/index.android.bundle')
      .API_BASE_URL).toBe('http://localhost:8000');
    expect(loadConfig(undefined).API_BASE_URL).toBe('http://localhost:8000');
  });

  it('keeps the redirect in step with the native URL scheme', () => {
    // android/app/src/main/AndroidManifest.xml and ios Info.plist both register
    // `aiassistant`, and the backend's FRONTEND_REDIRECT_URI must match.
    expect(loadConfig(undefined).AUTH_REDIRECT).toBe('aiassistant://auth');
  });
});
