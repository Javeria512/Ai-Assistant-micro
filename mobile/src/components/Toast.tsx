import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { FadeUp } from './animations';
import { Touch, Txt } from './primitives';
import { TAB_BAR_HEIGHT } from './TabBar';

/**
 * The dark undo toast. Sits above the tab bar when signed in, and clears the
 * home indicator on gesture-nav devices.
 */
export function Toast() {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast, undo, auth } = useApp();

  if (!toast) return null;

  const bottom =
    (auth === 'signedIn' ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom) + 16;

  return (
    <View style={[styles.wrap, { bottom }]}>
      <FadeUp>
        <View style={[styles.toast, { backgroundColor: c.toastBg }, s.toast]}>
          <Txt weight={500} style={styles.text} numberOfLines={2}>
            {toast}
          </Txt>
          <Touch onPress={undo} hitSlop={10} accessibilityRole="button">
            <Txt weight={600} style={[styles.undo, { color: c.toastAction }]}>
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
  wrap: { position: 'absolute', left: 18, right: 18, pointerEvents: 'box-none' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 17,
    borderRadius: 16,
  },
  text: { flex: 1, fontSize: 13, color: '#ffffff' },
  undo: { fontSize: 13 },
});
