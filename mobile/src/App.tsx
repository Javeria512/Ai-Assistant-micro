import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';

import { AlertsSheet, DetailSheet, Toast } from './components';
import { RootNavigator } from './navigation';
import { AppStoreProvider, useApp } from './store';
import { ThemeProvider, useTheme } from './theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <Themed />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}

/** Bridges the store's `dark` flag into the theme context. */
function Themed() {
  const { dark } = useApp();
  return (
    <ThemeProvider dark={dark}>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const { c, dark } = useTheme();
  const { auth } = useApp();
  const signedIn = auth === 'signedIn';

  // The Poppins faces are linked natively (assets/fonts + react-native.config.js),
  // so there is no font-loading gate here any more — every size in the design
  // measures correctly on the first frame. `restoring` still holds a blank frame
  // while the stored session is read back out of the keychain.
  if (auth === 'restoring') {
    return <View style={[styles.fill, { backgroundColor: c.canvas }]} />;
  }

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme: NavTheme = {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: c.tealFill,
      background: c.bg,
      card: c.chrome,
      text: c.ink,
      border: c.line,
    },
  };

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      {/* The login gradient is dark in both themes, so it always wants light
          status-bar content. No `backgroundColor`: the app is edge-to-edge, so
          the bar is already transparent and setting it only logs
          "Ignored status bar change, current activity is edge-to-edge". */}
      <StatusBar
        barStyle={!signedIn || dark ? 'light-content' : 'dark-content'}
        translucent
      />

      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>

      <Toast />
      <AlertsSheet />
      <DetailSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
