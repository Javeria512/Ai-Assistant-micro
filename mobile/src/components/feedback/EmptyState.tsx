import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ICON_WELL, RADIUS, SPACING, TYPE, useTheme } from '../../theme';
import { IconWell, Txt, type IconName } from '../ui';

export type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: IconName;
  /** Tinted well behind the glyph. Defaults to the teal wash. */
  tint?: string;
  /** Glyph colour. Defaults to teal. */
  color?: string;
  /** Drop the card fill — for empty states that sit inside another card. */
  bare?: boolean;
};

/**
 * The "nothing here" card, which the Chats, Tasks and Calendar screens each
 * wrote out separately with slightly different paddings and mark sizes.
 */
export function EmptyState({
  title,
  body,
  icon = 'check',
  tint,
  color,
  bare = false,
}: EmptyStateProps) {
  const { c, s } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        !bare && [{ backgroundColor: c.card, borderRadius: RADIUS.cardLg }, s.soft],
      ]}
    >
      <IconWell
        icon={icon}
        size={ICON_WELL.xl}
        shape="circle"
        bg={tint ?? c.tealSoft}
        fg={color ?? c.teal}
        ratio={0.48}
        strokeWidth={2.3}
      />
      <Txt weight={600} style={[TYPE.title, styles.title, { color: c.ink }]}>
        {title}
      </Txt>
      {!!body && (
        <Txt style={[TYPE.bodySm, styles.body, { color: c.ink3 }]}>{body}</Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xxxl + SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
});
