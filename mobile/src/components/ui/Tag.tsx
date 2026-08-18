import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ON_ACCENT, RADIUS, SPACING, TYPE, ms, useTheme } from '../../theme';
import { Txt } from './Txt';

/** A pill-shaped status tag. */
export function Tag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Txt weight={600} numberOfLines={1} style={[TYPE.captionSm, { color }]}>
        {label}
      </Txt>
    </View>
  );
}

/** The uppercase, wide-tracked label above AI content. */
export function Kicker({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Txt weight={600} style={[TYPE.kicker, { color }]}>
      {children}
    </Txt>
  );
}

/** The unread count that rides the corner of a tab icon. */
export function Badge({ count, max = 99 }: { count: number; max?: number }) {
  const { c } = useTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: c.vividRose }]}>
      <Txt weight={600} style={[TYPE.nano, { color: ON_ACCENT }]}>
        {count > max ? `${max}+` : count}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  badge: {
    position: 'absolute',
    top: -ms(4),
    right: -ms(7),
    minWidth: ms(17),
    height: ms(17),
    paddingHorizontal: ms(4),
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
