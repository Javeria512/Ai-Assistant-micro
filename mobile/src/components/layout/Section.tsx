import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SPACING, TYPE, useTheme } from '../../theme';
import { Txt } from '../ui';

/**
 * A titled block of a screen: heading, optional trailing note, and the content
 * beneath it at a consistent gap.
 *
 * Every screen previously wrote its own `h2` style — 16.5 in five files, with
 * different margins in each — so headings drifted apart over time.
 */
export function Section({
  title,
  trailing,
  gap = SPACING.md,
  style,
  children,
}: {
  title?: string;
  /** Right-aligned note beside the heading, e.g. "3 events". */
  trailing?: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={[{ gap }, style]}>
      {(title || trailing) && (
        <View style={styles.head}>
          {title ? (
            <Txt weight={600} style={[TYPE.title, styles.title, { color: c.ink }]}>
              {title}
            </Txt>
          ) : (
            <View style={styles.title} />
          )}
          {trailing}
        </View>
      )}
      {children}
    </View>
  );
}

/** The muted note that sits opposite a section heading. */
export function SectionNote({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Txt weight={500} style={[TYPE.caption, { color: c.teal }]}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  title: { flex: 1, minWidth: 0 },
});
