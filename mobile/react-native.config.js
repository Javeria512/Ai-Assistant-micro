/**
 * `assets` is what replaces `expo-font`: `npx react-native-asset` (or a
 * `run-android` build) copies these into `android/app/src/main/assets/fonts`
 * and registers them in the iOS project, so the faces are available to
 * `fontFamily` from the first frame — no runtime font loading, no blank frame.
 */
module.exports = {
  project: {
    android: {},
    ios: {},
  },
  assets: ['./assets/fonts'],
};
