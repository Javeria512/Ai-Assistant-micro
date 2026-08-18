import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks';
import { RADIUS, SPACING, TYPE, ms, useTheme } from '../../theme';
import { SHEET_IN, SHEET_OUT } from '../animations';
import { IconButton, Txt } from '../ui';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Cap as a share of window height when upright — 0.72 reminders, 0.84 details. */
  maxHeightRatio?: number;
  children: React.ReactNode;
  /** Pinned action row below the scrollable body. */
  footer?: React.ReactNode;
};

/**
 * The design's bottom sheet: a dimmed scrim over the whole screen and a panel
 * that slides up from the bottom edge, capped at a fraction of screen height.
 *
 * Rendered in a `Modal` so it sits above the tab bar and picks up the Android
 * back button for free.
 *
 * The cap goes through `sheetRatio`, which loosens it in landscape: 72% of a
 * 390pt-tall window is a 280pt sheet, too short to read the content it holds.
 */
export function Sheet({
  visible,
  onClose,
  maxHeightRatio = 0.72,
  children,
  footer,
}: SheetProps) {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, sheetRatio, gutter } = useResponsive();

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
      useNativeDriver: true,
      ...SHEET_OUT,
    });
    anim.start();
    // Unmount on a timer rather than the animation's completion callback: the
    // callback does not reliably report `finished` across platforms, and a
    // sheet that fails to unmount keeps an invisible modal over the whole app.
    // Reopening mid-exit clears this before it fires.
    const done = setTimeout(() => setMounted(false), SHEET_OUT.duration + 20);
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
              maxHeight: height * sheetRatio(maxHeightRatio),
              paddingLeft: insets.left,
              paddingRight: insets.right,
              marginHorizontal: gutter,
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
                { backgroundColor: c.chrome, paddingBottom: SPACING.lg + insets.bottom },
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
  titleStyle = TYPE.h4,
}: {
  title: string;
  meta: string;
  onClose: () => void;
  titleStyle?: (typeof TYPE)[keyof typeof TYPE];
}) {
  const { c } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Txt weight={700} style={[titleStyle, { color: c.ink }]}>
          {title}
        </Txt>
        <Txt style={[TYPE.caption, styles.meta, { color: c.ink3 }]}>{meta}</Txt>
      </View>
      <IconButton
        icon="close"
        onPress={onClose}
        accessibilityLabel="Close"
        bg={c.card}
        fg={c.ink2}
        size={ms(34)}
        round={false}
        style={styles.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    overflow: 'hidden',
    // A sheet stretched across a tablet reads as a broken dialog; capping and
    // centring it keeps it a sheet.
    width: '100%',
    maxWidth: ms(640),
    alignSelf: 'center',
  },
  close: { marginTop: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  meta: { marginTop: SPACING.xxs },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
});
