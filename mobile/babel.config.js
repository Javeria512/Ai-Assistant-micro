module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Expo inlined `EXPO_PUBLIC_*` at bundle time and read `.env` for free.
    // React Native CLI does neither, so the same override lands through this
    // babel plugin instead: `API_URL` in `mobile/.env` becomes a compile-time
    // constant imported from '@env'.
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
};
