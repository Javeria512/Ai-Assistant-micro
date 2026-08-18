import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useApp } from '../../store';
import { ICON_WELL, SPACING, TYPE, useTheme } from '../../theme';
import { Button, IconWell, Txt } from '../ui';

/**
 * Wraps a screen body so every tab shows the same thing while the daily brief
 * is loading or after it fails, instead of each rendering an empty shell.
 *
 * Gating on the view model rather than on a per-screen fetch is what lets all
 * five tabs share one request.
 */
export function ScreenState({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const { vm, error, refresh } = useApp();

  if (vm) return <>{children}</>;

  // No view model and no error means the first load is still in flight —
  // whether or not `loading` has been set yet.
  if (!error) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.vividTeal} />
        <Txt style={[TYPE.bodyMd, { color: c.ink3 }]}>Reading your day…</Txt>
      </View>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <IconWell
        icon="warnTriangle"
        size={ICON_WELL.xl}
        shape="circle"
        bg={c.roseSoft}
        fg={c.rose}
        ratio={0.46}
      />
      <Txt weight={600} style={[TYPE.title, { color: c.ink }]}>
        Could not load your day
      </Txt>
      <Txt style={[TYPE.bodySm, styles.body, { color: c.ink3 }]}>{error}</Txt>
      <Button label="Try again" onPress={refresh} style={styles.retry} inline />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  body: { textAlign: 'center' },
  retry: { marginTop: SPACING.xs, alignSelf: 'center' },
});
