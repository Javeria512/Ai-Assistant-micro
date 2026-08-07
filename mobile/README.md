# AI Assistant — React Native client

The mobile frontend for the AI Executive Personal Assistant, built from the
**AI Assistant Vivid** design doc and wired to the FastAPI backend in `../app`.
React Native 0.86 (React Native CLI, bare workflow) / TypeScript. `android/`
and `ios/` are checked-in source, not generated output.

## Running it on a device

Four things have to be up at once. From the repo root:

```bash
.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then, with the phone plugged in and USB debugging authorised:

```bash
cd mobile && npm run tunnel
```

That is `adb reverse` for **both** ports, and it is the step people forget.
`react-native run-android` forwards 8081 on its own so Metro works, but nothing
forwards 8000 — so the app builds, installs, launches, and then reports
*"Cannot reach the backend at http://localhost:8000"*. The tunnel is what makes
`localhost:8000` on the *phone* resolve to the backend on your machine,
including inside Chrome, which is where the Microsoft OAuth callback lands.

The mappings do not survive `adb kill-server`, unplugging, or a reboot — re-run
`npm run tunnel` after any of those.

```bash
npm install
npm run dev:android   # tunnel + build + install (first run is slow)
npm start             # Metro, for subsequent JS-only changes
```

### If `npm run android` cannot find `gradlew.bat`

The CLI shells out to `gradlew.bat` by bare name, which relies on the current
directory being searched. If the machine sets
`NoDefaultCurrentDirectoryInExePath=1` — as this one does — that lookup fails
with *"'gradlew.bat' is not recognized"* before Gradle ever starts. Either clear
it for the session:

```bash
set NoDefaultCurrentDirectoryInExePath=
```

or drive Gradle directly, which is all `run-android` does:

```bash
cd android && ./gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
```

`npm start`, `npm test` and `npm run typecheck` are unaffected.

`.env` at the repo root must contain `FRONTEND_REDIRECT_URI=aiassistant://auth`
so the backend knows where to hand the session back.

### Over Wi-Fi instead of USB

Skip `adb reverse` and point the app at your machine's LAN address, either in
`mobile/.env` (see `.env.example`) or in Metro's environment:

```bash
API_URL=http://192.168.1.x:8000 npm start -- --reset-cache
```

`API_URL` is inlined into the bundle by `react-native-dotenv`, so it is read
when the bundle is built — hence the cache reset rather than a live reload.

Azure has `http://localhost:8000/auth/microsoft/callback` registered as the
redirect URI, so sign-in still needs the tunnel — add the LAN URL to the Azure
app registration if you want to drop USB entirely.

### iOS

```bash
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

The Xcode project registers the four Poppins faces and the `aiassistant://`
URL scheme. It has not been built on a Mac in this repo yet — there was no
`ios/` directory before the CLI migration, so treat the first `pod install` as
the point where it gets exercised.

---

## What's here

Six screens and every interaction from the design:

| Screen | Contents |
|---|---|
| **Login** | Gradient hero, Microsoft sign-in, read-only promises |
| **Home** | 2×2 glance tiles, AI composer with canned replies, short summary |
| **Calendar** | Week strip, next-up hero, timeline agenda with a continuous rail |
| **Chats** | Priority message cards, AI suggestions, reply / open / snooze |
| **Tasks** | Priority insight, check-off with live progress, completed row |
| **Profile** | Identity hero, stats, connected sources, preferences, dark mode |

Plus the smart-reminders sheet, the shared detail sheet (messages *and* events),
the undo toast, and a full light/dark theme.

State is global and cross-screen: replying to a message drops the Chats badge
*and* Home's "Replies" tile; checking a task moves its progress bar to 100% *and*
decrements Home's "pending" count. Undo restores it.

## Layout

```
App.tsx                     fonts, providers, navigation container
src/
  api/       config.ts       resolves the backend base URL (adb reverse / LAN)
             client.ts       fetch wrapper: bearer auth, one refresh per 401
             types.ts        mirrors the backend's OpenAPI schemas
  auth/      session.ts      OAuth via in-app browser, tokens in SecureStore
  theme/     tokens.ts       LIGHT / DARK palettes, radii, font families
             shadows.ts      the design's shadow stacks as boxShadow arrays
             ThemeProvider   useTheme() -> { dark, c, s }
  data/      adapters.ts     backend DTOs -> the shapes the screens render
             content.ts      static UI copy only
  store/     AppStore.tsx    auth + data loading + local UI state
  components/                Icon (all SVG paths), Header, TabBar, Sheet,
                             Toast, FilterRow, ScreenState, animations
  screens/                   one file per screen
  overlays/                  AlertsSheet, DetailSheet
  navigation/                stack (auth gate) + bottom tabs
```

## How the data flows

Sign-in is a backend-owned OAuth flow — the app never sees the client secret:

1. App asks `GET /auth/login?response=json&redirect_uri=aiassistant://auth`.
2. It opens the returned Microsoft URL in an in-app browser tab.
3. Microsoft redirects to `http://localhost:8000/auth/microsoft/callback`,
   which reaches the backend through `adb reverse`.
4. The backend redeems the code and 303s to `aiassistant://auth#access_token=…`.
   Tokens ride in the URL *fragment*, so they never hit a server or access log.
5. The app reads them off the deep link and stores them in SecureStore.

After that, one call — `GET /api/v1/assistant/daily-brief` — supplies every
screen. `adapters.ts` reshapes it; a 401 triggers a single `POST /auth/refresh`
and retry before the session is dropped.

## Where the design outruns the backend

The design was drawn against a fixed scenario. Three slots have no backend
equivalent, and are handled honestly rather than faked:

- **Free-text "Ask your AI"** — there is no Q&A endpoint, so a question runs
  `GET /api/v1/assistant/summary` and answers with its narrative.
- **Completed tasks** — the brief carries only pending work, so the design's
  struck-through row is replaced by an empty state.
- **Profile stats** (`96% on-time`, `3.5h saved`) — no such metrics exist;
  the tiles show real meeting, open-task and overdue counts instead.

Priority buckets drive the colour coding: `critical`→rose, `high`→amber,
`medium`→periwinkle, `low`→teal.

## Notes on the port

Three places where the code deliberately departs from the design file:

1. **Dark-mode contrast.** The doc's dark palette turns `--v-peri`, `--v-rose`
   and `--v-lime` into light tints, but the tiles filled with them keep white
   text — roughly 2:1 on the Tasks, Replies and Focus tiles. Teal already
   avoided this by splitting `teal` (text) from `tealFill` (surface), so
   `periFill` / `roseFill` / `limeFill` extend that same split. Light mode is
   unchanged.

2. **Filter rows.** The Chats and Tasks filters are static in the design. They
   are wired here to `channel` / `urgent` / `category` fields on the data.

3. **Hover → press.** The design's hover states (brightness, lift) become
   press-down feedback, since touch has no hover.

Everything else — spacing, radii, type scale, colours, copy — is as authored.

## Known cosmetics

- `props.pointerEvents is deprecated` in the console comes from
  `@react-navigation` internals, not this code.
- The in-app dark toggle is independent of the OS appearance, so on a dark-mode
  device the system keyboard can differ from a light in-app theme. Wire the
  store's initial `dark` to `useColorScheme()` if they should agree.
- `Terms` / `Privacy Policy` on the login screen are styled but inert — the
  design gave them placeholder anchors with no destination.
