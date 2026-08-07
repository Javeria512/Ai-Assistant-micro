import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { SHEET_IN } from './animations';
import { Icon } from './Icon';
import { Touch, Txt } from './primitives';

/** How long the sheet takes to slide back out. */
const EXIT_MS = 180;

/**
 * The design's bottom sheet: a dimmed scrim over the whole screen and a panel
 * that slides up from the bottom edge, capped at a fraction of screen height.
 *
 * Rendered in a `Modal` so it sits above the tab bar and picks up the Android
 * back button for free.
 */
export function Sheet({
  visible,
  onClose,
  maxHeightRatio = 0.72,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  /** Cap as a share of window height — 0.72 for reminders, 0.84 for details. */
  maxHeightRatio?: number;
  children: React.ReactNode;
  /** Pinned action row below the scrollable body. */
  footer?: React.ReactNode;
}) {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Keep the panel mounted through its exit animation.
  const [mounted, setMounted] = useState(visible);
  const t = useRef(new Animated.Value(0)).current;

  // `mounted` stays out of the deps: it changes as a *result* of this effect,
  // and feeding it back in restarts the animation mid-flight.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      const anim = Animated.timing(t, {
        toValue: 1,
        useNativeDriver: true,
        ...SHEET_IN,
      });
      anim.start();
      return () => anim.stop();
    }

    const anim = Animated.timing(t, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    // Unmount on a timer rather than the animation's completion callback: the
    // callback does not reliably report `finished` across platforms, and a
    // sheet that fails to unmount keeps an invisible modal over the whole app.
    // Reopening mid-exit clears this before it fires.
    const done = setTimeout(() => setMounted(false), EXIT_MS + 20);
    return () => {
      anim.stop();
      clearTimeout(done);
    };
  }, [visible, t]);

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: t }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            s.sheet,
            {
              backgroundColor: c.bg,
              maxHeight: height * maxHeightRatio,
              // The design's entrance starts at .4 opacity; the exit still has
              // to reach 0, so the curve rises fast to .4 then eases to full.
              opacity: t.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0, 0.4, 1],
              }),
              transform: [
                {
                  translateY: t.interpolate({
                    inputRange: [0, 1],
                    outputRange: [34, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {children}
          {footer ? (
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: c.chrome,
                  paddingBottom: 18 + insets.bottom,
                },
              ]}
            >
              {footer}
            </View>
          ) : (
            <View style={{ height: insets.bottom }} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Title / subtitle / close-button row shared by both sheets. */
export function SheetHeader({
  title,
  meta,
  onClose,
  titleSize = 18,
}: {
  title: string;
  meta: string;
  onClose: () => void;
  titleSize?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Txt
          weight={700}
          style={{
            fontSize: titleSize,
            lineHeight: titleSize * 1.3,
            letterSpacing: titleSize * -0.02,
            color: c.ink,
          }}
        >
          {title}
        </Txt>
        <Txt style={[styles.meta, { color: c.ink3 }]}>{meta}</Txt>
      </View>
      <Touch
        onPress={onClose}
        style={[styles.closeBtn, { backgroundColor: c.card }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
      >
        <Icon name="close" size={17} color={c.ink2} />
      </Touch>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerText: { flex: 1, minWidth: 0 },
  meta: { fontSize: 12.5, marginTop: 4 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
