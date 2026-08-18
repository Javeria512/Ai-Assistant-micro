import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SPACING } from '../../theme';
import { Chip } from '../ui';
import { useScreenGutter } from './Screen';

/**
 * The horizontally scrolling pill filters above the Chats and Tasks lists.
 *
 * It scrolls rather than wraps on purpose: the option list comes from whichever
 * To Do lists the user actually has, so its width is not knowable in advance and
 * a wrapping row would push the content down by an unpredictable amount.
 */
export function FilterRow<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel = 'Filter',
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}) {
  const gutter = useScreenGutter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.row, gutter]}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => (
        <Chip
          key={opt}
          label={opt}
          selected={opt === value}
          onPress={() => onChange(opt)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow: 0 stops the row claiming the rest of the screen's height.
  scroller: { flexGrow: 0, flexShrink: 0 },
  row: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xxs,
    paddingBottom: SPACING.md,
  },
});
