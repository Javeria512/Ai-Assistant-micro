import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks';
import { useApp } from '../../store';
import { HIT_SLOP, ON_ACCENT, SPACING, TYPE, ms, useTheme } from '../../theme';
import { FadeUp } from '../animations';
import { Touch, Txt } from '../ui';

/**
 * The dark undo toast. Sits above the tab bar when signed in, and clears the
 * home indicator on gesture-nav devices.
 */
export function Toast() {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { tabBarHeight, gutter } = useResponsive();
  const { toast, undo, auth } = useApp();

  if (!toast) return null;

  const bottom =
    (auth === 'signedIn' ? tabBarHeight + insets.bottom : insets.bottom) + SPACING.lg;

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom,
          left: gutter + insets.left,
          right: gutter + insets.right,
        },
      ]}
    >
      <FadeUp>
        <View style={[styles.toast, { backgroundColor: c.toastBg }, s.toast]}>
          <Txt weight={500} numberOfLines={2} style={[TYPE.bodySm, styles.text]}>
            {toast}
          </Txt>
          <Touch
            onPress={undo}
            hitSlop={HIT_SLOP + 2}
            accessibilityRole="button"
            accessibilityLabel="Undo"
          >
            <Txt weight={600} style={[TYPE.bodySm, { color: c.toastAction }]}>
              Undo
            </Txt>
          </Touch>
        </View>
      </FadeUp>
    </View>
  );
}

const styles = StyleSheet.create({
  // box-none so the strip spanning the screen does not eat taps beside the toast.
  wrap: { position: 'absolute', pointerEvents: 'box-none' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: ms(16),
  },
  text: { flex: 1, minWidth: 0, color: ON_ACCENT },
});
