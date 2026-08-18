import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks';
import { SPACING, useTheme } from '../../theme';

export type ScreenProps = {
  children: React.ReactNode;
  /** Wires up pull-to-refresh when both are supplied. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Lifts content clear of the keyboard — the Home composer needs this. */
  keyboardAware?: boolean;
  /** Vertical rhythm between the children the screen passes in. */
  gap?: number;
  /** Extra space above the first child. */
  topInset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollView | null>;
  /** Content rendered outside the scroll area, pinned above it. */
  header?: React.ReactNode;
};

/**
 * The page container every tab screen sits in.
 *
 * Before this existed each screen repeated the same `ScrollView` +
 * `RefreshControl` + `paddingHorizontal: 18` + `paddingBottom: 24` block, which
 * is also why none of them handled a rotated phone. Centralising it means three
 * responsive behaviours now apply everywhere at once:
 *
 * * **Gutters scale.** 12pt on a small phone, 18 on a normal one, 24 on a
 *   tablet — from `useResponsive`, not a hard-coded 18.
 * * **The column is capped and centred.** Past ~640pt the content stops
 *   stretching, so a tablet or a landscape phone shows a readable column rather
 *   than cards smeared edge to edge.
 * * **Landscape notches are respected.** A phone on its side puts the cutout on
 *   the left or right edge; the horizontal safe-area insets are added to the
 *   gutter so nothing lands underneath it.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  keyboardAware = false,
  gap = SPACING.xl,
  topInset = SPACING.xxs,
  contentContainerStyle,
  scrollRef,
  header,
}: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, sideInset } = useResponsive();

  const horizontal = {
    paddingLeft: gutter + sideInset + insets.left,
    paddingRight: gutter + sideInset + insets.right,
  };

  const body = (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={[
        styles.content,
        horizontal,
        { paddingTop: topInset, gap },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={c.vividTeal}
            colors={[c.vividTeal]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );

  const inner = header ? (
    <View style={styles.fill}>
      {header}
      {body}
    </View>
  ) : (
    body
  );

  if (!keyboardAware) {
    return <View style={[styles.fill, { backgroundColor: c.bg }]}>{inner}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: c.bg }]}
      // Android resizes the window itself; adding padding on top of that
      // double-counts the keyboard and leaves a gap.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

/**
 * The horizontal padding `Screen` applies, for the few things rendered outside
 * its scroll area that must still line up with it — the filter row above the
 * Chats and Tasks lists.
 */
export function useScreenGutter() {
  const insets = useSafeAreaInsets();
  const { gutter, sideInset } = useResponsive();
  return {
    paddingLeft: gutter + sideInset + insets.left,
    paddingRight: gutter + sideInset + insets.right,
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: SPACING.xxl, flexGrow: 1 },
});
