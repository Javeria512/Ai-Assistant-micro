import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { Icon } from './Icon';
import { Touch, Txt } from './primitives';

/**
 * Wraps a screen body so every tab shows the same thing while the daily brief
 * is loading or after it fails, instead of each rendering an empty shell.
 */
export function ScreenState({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const { vm, loading, error, refresh } = useApp();

  if (vm) return <>{children}</>;

  if (loading || (!error && !vm)) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.vividTeal} />
        <Txt style={[styles.hint, { color: c.ink3 }]}>Reading your day…</Txt>
      </View>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <View style={[styles.mark, { backgroundColor: c.roseSoft }]}>
        <Icon name="warnTriangle" size={26} color={c.rose} />
      </View>
      <Txt weight={600} style={[styles.title, { color: c.ink }]}>
        Could not load your day
      </Txt>
      <Txt style={[styles.body, { color: c.ink3 }]}>{error}</Txt>
      <Touch
        onPress={refresh}
        dim={0.85}
        style={[styles.retry, { backgroundColor: c.tealFill }]}
        accessibilityRole="button"
      >
        <Txt weight={600} style={styles.retryText}>
          Try again
        </Txt>
      </Touch>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  hint: { fontSize: 13.5 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16.5 },
  body: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retry: {
    marginTop: 6,
    paddingHorizontal: 22,
    height: 46,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, color: '#ffffff' },
});
