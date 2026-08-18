import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconWell, Kicker, Txt } from '../../../components/ui';
import { ICON_WELL, ON_ACCENT, RADIUS, SPACING, TYPE, useTheme } from '../../../theme';

/** The assistant's explanation of why the list is ordered the way it is. */
export function PriorityInsight({ text }: { text: string }) {
  const { c, s } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card }, s.card]}>
      <View style={styles.head}>
        <IconWell
          icon="sparkle"
          size={ICON_WELL.sm}
          bg={c.vividTeal}
          fg={ON_ACCENT}
          ratio={0.58}
        />
        <Kicker color={c.teal}>Priority insight</Kicker>
      </View>
      <Txt style={[TYPE.bodyLg, { color: c.ink }]}>{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: RADIUS.cardLg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
});
