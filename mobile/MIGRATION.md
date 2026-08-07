# Expo → React Native CLI migration

React Native stays at **0.86.2** and React at **19.2.3** — the same versions Expo
SDK 57 was pinning — so no component, style or navigation behaviour moved. What
changed is everything *around* the app code: the entrypoint, the build system,
and the ten Expo modules the app was calling.

## Package substitutions

| Expo package | Replacement | Notes |
|---|---|---|
| `expo` (`registerRootComponent`) | `AppRegistry.registerComponent` | `index.ts` → `index.js`, component name `AIAssistant` from `app.json`, matched in `MainActivity.getMainComponentName()` and iOS `startReactNative`. |
| `expo-status-bar` | `StatusBar` from `react-native` | `style="light"` → `barStyle="light-content"`, plus `translucent` + transparent background, which is what expo-status-bar defaulted to. |
| `expo-font` + `@expo-google-fonts/poppins` | native font linking | The same four TTFs now live in `assets/fonts/`, linked by `react-native.config.js` (`npx react-native-asset`) into `android/app/src/main/assets/fonts/` and the Xcode project's `UIAppFonts`. |
| `expo-constants` (`expoConfig.hostUri`) | `NativeModules.SourceCode.scriptURL` | Same idea — read the host that served the bundle — from React Native's own module. |
| `expo-linear-gradient` | `react-native-linear-gradient` | Same `colors` / `locations` / `start` / `end` props; default import instead of named, and the readonly token tuples are copied because it wants mutable arrays. |
| `expo-secure-store` | `react-native-keychain` | Keyed by `service: 'ai-assistant.session'` instead of an item key. `ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` preserves SecureStore's "readable after a cold start" behaviour. |
| `expo-web-browser` (`openAuthSessionAsync`) | `react-native-inappbrowser-reborn` (`openAuth`) | Near drop-in: same `(url, redirectUrl, options)` signature and the same `{type:'success', url}` result. A `Linking` + `AppState` fallback covers devices with no Custom Tabs provider. |
| `expo-linking` | — | Was never imported; `Linking` from `react-native` covers the fallback path. |
| `expo-system-ui` | — | Was never imported. |
| `@expo/metro-runtime`, `react-native-web`, `react-dom` | — | Web-only. React Native CLI has no web target, so the web build is gone (see *Dropped* below). |
| `EXPO_PUBLIC_API_URL` | `API_URL` via `react-native-dotenv` | Read from `mobile/.env` or Metro's environment and inlined at bundle time, which is what the `EXPO_PUBLIC_` prefix did. |

Font family names moved from Expo's `useFonts` keys to the faces' PostScript
names (`Poppins_600SemiBold` → `Poppins-SemiBold`), because that is what
natively linked fonts resolve by on both platforms. Same files, same rendering.

## Project scaffolding

Added, from the official `@react-native-community/template@0.86.2`:
`index.js`, `babel.config.js`, `metro.config.js`, `jest.config.js`,
`react-native.config.js`, `.watchmanconfig`, `.eslintrc.js`, `.prettierrc.js`,
`Gemfile`, `.bundle/config`. `app.json` became `{name, displayName}`;
`tsconfig.json` extends `@react-native/typescript-config` instead of
`expo/tsconfig.base`.

`metro.config.js` carries one addition over the template: a `blockList` for
native build output (`.cxx/`, `android/build`, `ios/Pods`, …). Without Watchman
installed, Metro falls back to a recursive `fs.watch` crawl, and it crashed with
`ENOENT` when Gradle deleted a CMake scratch directory under
`node_modules/react-native-screens/android/.cxx` mid-walk. `@expo/metro-config`
had excluded those paths; the bare config does not.

`.gitignore` now tracks `android/` and `ios/` as source and ignores only their
build output — the reverse of the Expo setup, where both were prebuild artifacts.

## Native Android

Rebuilt on the CLI template, keeping the app's own identity and resources:

- **Removed** the `expo-autolinking-settings` / `expo-root-project` Gradle
  plugins, `expoAutolinking.useExpoModules()`, the `expo/scripts/resolveAppEntry`
  entry-file hook, `@expo/cli export:embed` bundling, the `expo.*` gradle
  properties, and the `expo.modules.updates.*` manifest metadata.
- **`MainApplication.kt`** now uses `DefaultReactHost.getDefaultReactHost` in
  place of `ExpoReactHostFactory`, and drops the
  `ApplicationLifecycleDispatcher` hooks.
- **`MainActivity.kt`** uses `DefaultReactActivityDelegate` directly instead of
  `ReactActivityDelegateWrapper`, and returns `AIAssistant` rather than `main`.
  The `setTheme(R.style.AppTheme)` + `super.onCreate(null)` pair is kept: the
  first hands off from the splash window background, the second is required by
  react-native-screens.
- **Kept unchanged:** launcher icons and adaptive-icon XML, the splash drawables
  and `Theme.App.SplashScreen`, `colors.xml`, `strings.xml`, portrait lock,
  `singleTask`, `enableOnBackInvokedCallback="false"`, the debug keystore, and
  the `aiassistant://` intent filter.
- **`allowBackup`** is now `false`. The Expo manifest set it `true` and excluded
  the SecureStore entry through `@xml/secure_store_backup_rules`, a resource that
  came from the expo-secure-store AAR; with that module gone, `false` is what
  keeps session tokens out of device backups.
- The `<queries>` block for `https` VIEW intents is retained — Custom Tabs
  cannot discover a browser without it on Android 11+, so sign-in depends on it.

## Native iOS

There was no `ios/` directory before (only `android/` had been prebuilt), so one
was generated from the same template and renamed to `AIAssistant` /
`com.aiassistant.app`, with the Poppins faces in `UIAppFonts`, the
`aiassistant://` URL scheme in `CFBundleURLTypes`, portrait-only iPhone
orientation, and `NSAllowsLocalNetworking` for the dev backend. **It has not
been compiled** — that needs macOS and Xcode, neither of which was available.

## Backend wiring

`src/api/client.ts` now covers the whole FastAPI surface rather than the seven
calls the dashboard makes: `/health`, `/health/ready`, the four `/auth/*`
endpoints, `users/me` (+ `photo`, `mailbox`, `preferences` read and PATCH),
`mail/{messages,important,messages/{id}}`, `calendar/{today,events,conflicts}`,
`chats/{,important,{id}/messages}`, `tasks/{pending,,lists,summary}`, and
`assistant/{priorities,daily-brief,summary,priority-weights}`.

The screens' data flow is deliberately unchanged: `daily-brief` is documented as
"everything the dashboard needs in one call" and fans out server-side, so it
stays the single load, with `/auth/session` alongside it for scope detection.
Re-pointing screens at the per-source endpoints would have changed request
behaviour, which the brief ruled out.

## Dropped

**Web.** Expo served this app in a browser through `react-native-web` and
`@expo/metro-runtime`. React Native CLI has no web target, so `npm run web` is
gone. Nothing in `src/` was web-specific.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx jest` | 65 tests, 4 suites, all passing |
| Metro production bundle (android) | 1.47 MB, no Expo modules resolved |
| `gradlew assembleDebug` | BUILD SUCCESSFUL, 244 tasks |
| Autolinking | all 6 native libraries merged and built their AARs |
| APK contents | 4 Poppins TTFs at `assets/fonts/`, native libs present |
| Merged manifest | `aiassistant://` filter, portrait, cleartext in debug, no `expo.*` |
| iOS project | `project.pbxproj` parses; target/bundle id/version correct, 4 fonts in Resources (not compiled — needs a Mac) |

Run on hardware (Galaxy A17 5G / Android 16) and on a Pixel 8 Pro emulator
(Android 15), both against the live FastAPI backend:

| Check | Result |
|---|---|
| Launch | no crash; `Running "AIAssistant" … "fabric":true` |
| Fonts | Poppins renders from the first frame, no reflow |
| Login screen | gradient, SVG icons, safe-area insets, light status bar all correct |
| Keychain | session restore resolves (app settles on Login rather than hanging on `restoring`) |
| API base URL | resolved to `http://localhost:8000` over `adb reverse` |
| `GET /auth/login` | reached the backend; MSAL returned the authorization URL |
| In-app browser | `ChromeTabsManagerActivity` launched, Microsoft sign-in page loaded |
| Deep link | `aiassistant://auth#…` routed to `MainActivity` (LAUNCH_SINGLE_TASK) |
| Signed-in shell | tab bar + "Reading your day…" state rendered after the deep link |
| Bearer auth | backend answered *"Session token is invalid"* — not *"Missing bearer token"* — so the `Authorization` header was sent |
| 401 path | refresh attempted once, then signed out cleanly; button re-enabled |

Completing a real Microsoft sign-in needs tenant credentials, so the flow was
verified up to the live sign-in page and then again from the callback side with
a synthetic deep link.
