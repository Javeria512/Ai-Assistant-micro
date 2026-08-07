# This is a bare React Native CLI project

Not Expo. There is no `app.json` Expo config, no config plugins, and no
`expo prebuild` — `android/` and `ios/` are checked-in source you edit directly,
and a native dependency needs its autolinking to be verified with a real build.

React Native 0.86. Read https://reactnative.dev/docs/getting-started-without-a-framework
and the 0.86 release notes before writing native or build code.

Substitutions already made, in case a snippet suggests the Expo original:

| Expo | here |
|---|---|
| `expo-status-bar` | `StatusBar` from `react-native` |
| `expo-font` + `@expo-google-fonts/*` | `assets/fonts` + `react-native.config.js` (`npx react-native-asset`) |
| `expo-constants` (`hostUri`) | `NativeModules.SourceCode.scriptURL` |
| `expo-linear-gradient` | `react-native-linear-gradient` (default export) |
| `expo-secure-store` | `react-native-keychain` (addressed by `service`) |
| `expo-web-browser` | `react-native-inappbrowser-reborn` (`openAuth`) |
| `EXPO_PUBLIC_*` | `react-native-dotenv`, imported from `@env` |
| `registerRootComponent` | `AppRegistry.registerComponent` in `index.js` |

After changing fonts or other linked assets, re-run `npx react-native-asset`.
After adding a native dependency, run `npm run android` — `npm start` alone will
not surface an autolinking or Gradle failure.
