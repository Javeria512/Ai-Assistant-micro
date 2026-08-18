import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ON_ACCENT, RADIUS, SPACING, TYPE, useTheme } from '../../theme';
import { Touch } from './Touch';
import { Txt } from './Txt';

export type ChipProps = {
  label: string;
  onPress?: () => void;
  /** Filled teal when selected — the filter rows. */
  selected?: boolean;
  /** Raised card fill rather than a flat one — the "Ask your AI" suggestions. */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A tappable pill: filter options and starter prompts. */
export function Chip({ label, onPress, selected = false, raised = false, style }: ChipProps) {
  const { c, s } = useTheme();

  return (
    <Touch
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: c.tealFill }
          : raised
            ? { backgroundColor: c.card }
            : null,
        raised && !selected ? s.soft : null,
        style,
      ]}
    >
      <Txt
        weight={selected ? 600 : 500}
        numberOfLines={1}
        style={[TYPE.bodySm, { color: selected ? ON_ACCENT : c.ink3 }]}
      >
        {label}
      </Txt>
    </Touch>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    // Keeps a long filter name from forcing the row wider than the screen.
    maxWidth: '100%',
  },
});
