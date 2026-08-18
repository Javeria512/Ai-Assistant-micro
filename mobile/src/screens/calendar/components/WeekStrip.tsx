import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../../../components/ui';
import type { WeekDay } from '../../../models/view';
import { ON_ACCENT, SPACING, TYPE, ms, useTheme } from '../../../theme';

/** The five-day working-week strip, today highlighted. */
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const { c, s } = useTheme();

  return (
    <View style={styles.week}>
      {days.map((d) => (
        <View
          key={`${d.day}-${d.date}`}
          style={[
            styles.day,
            d.active
              ? [{ backgroundColor: c.tealFill }, s.colored(c.tealFill)]
              : [{ backgroundColor: c.card }, s.soft],
          ]}
          accessibilityLabel={d.active ? `${d.day} ${d.date}, today` : `${d.day} ${d.date}`}
        >
          <Txt
            weight={500}
            numberOfLines={1}
            style={[TYPE.captionSm, { color: d.active ? ON_ACCENT : c.ink3 }]}
          >
            {d.day}
          </Txt>
          <Txt
            weight={d.active ? 700 : 600}
            numberOfLines={1}
            style={[TYPE.h3, { color: d.active ? ON_ACCENT : c.ink }]}
          >
            {d.date}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', gap: SPACING.sm },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: SPACING.xxs,
    paddingVertical: SPACING.md,
    paddingHorizontal: 2,
    borderRadius: ms(16),
  },
});
