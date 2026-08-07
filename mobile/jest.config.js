module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@react-navigation|react-native-linear-gradient|react-native-keychain|react-native-inappbrowser-reborn|react-native-safe-area-context|react-native-screens|react-native-svg)/)',
  ],
};
