import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Txt } from '../../../components/ui';
import type { NextUp } from '../../../models/view';
import { ON_ACCENT, RADIUS, SPACING, TYPE, ms, useTheme } from '../../../theme';

const DOT = ms(5);

/** The saturated "next up" hero above the agenda. */
export function NextUpCard({ event, onOpen }: { event: NextUp; onOpen: () => void }) {
  const { c, s } = useTheme();

  return (
    <View style={[styles.hero, { backgroundColor: c.tealFill }, s.colored(c.tealFill)]}>
      <View style={styles.top}>
        <View style={styles.grow}>
          <Txt weight={700} style={[TYPE.h4, styles.onFill]}>
            {event.title}
          </Txt>
          <View style={styles.time}>
            <Icon name="clock" size={ms(15)} color={ON_ACCENT} strokeWidth={2} />
            <Txt weight={500} style={[TYPE.bodyMd, styles.onFill]}>
              {event.time}
            </Txt>
          </View>
        </View>

        <IconButton
          icon="dotsVertical"
          onPress={onOpen}
          accessibilityLabel="Event options"
          bg="rgba(255,255,255,0.2)"
          fg={ON_ACCENT}
          size={ms(30)}
          round={false}
        />
      </View>

      <View style={styles.points}>
        {event.points.map((p) => (
          <View key={p} style={styles.pointRow}>
            <View style={[styles.dot, { marginTop: (Number(TYPE.bodySm.lineHeight) - DOT) / 2 }]} />
            <Txt style={[TYPE.bodySm, styles.pointText]}>{p}</Txt>
          </View>
        ))}
      </View>

      <Button
        label={event.cta}
        onPress={onOpen}
        variant="onAccent"
        inline
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: SPACING.lg, borderRadius: RADIUS.cardLg },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  grow: { flex: 1, minWidth: 0 },
  onFill: { color: ON_ACCENT },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  points: { gap: SPACING.xs, marginTop: SPACING.md },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: ON_ACCENT },
  pointText: { flex: 1, minWidth: 0, color: ON_ACCENT },
  cta: { marginTop: SPACING.md },
});
