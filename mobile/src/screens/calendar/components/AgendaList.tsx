import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, AvatarStack, Icon, Touch, Txt } from '../../../components/ui';
import type { AgendaEntry } from '../../../models/view';
import { AVATAR, ON_ACCENT, RADIUS, SPACING, TYPE, ms, useTheme } from '../../../theme';

const RAIL_WIDTH = ms(16);
const RAIL_TIME_WIDTH = ms(58);
const NODE = ms(10);
const RING = ms(16);

/**
 * The timeline: a time gutter, a continuous teal rail, and one saturated card
 * per event. The rail is drawn per row — a segment above the node, a segment
 * below — so it joins up across rows without a separate absolutely-positioned
 * line that would have to know the list's total height.
 */
export function AgendaList({
  events,
  onOpen,
}: {
  events: AgendaEntry[];
  onOpen: (id: string) => void;
}) {
  const { c, s } = useTheme();

  const fillFor = (tone: AgendaEntry['tone']) =>
    tone === 'peri' ? c.periFill : tone === 'amber' ? c.amberFill : c.limeFill;

  return (
    <View>
      {events.map((ev, i) => {
        const first = i === 0;
        const last = i === events.length - 1;
        const fill = fillFor(ev.tone);
        const fg = ev.tone === 'amber' ? c.onAmber : ON_ACCENT;

        return (
          <View key={ev.id} style={styles.row}>
            <Txt
              weight={500}
              numberOfLines={1}
              style={[TYPE.captionSm, styles.railTime, { color: c.ink3 }]}
            >
              {ev.rail}
            </Txt>

            <View style={styles.rail}>
              <View
                style={[
                  styles.railLine,
                  { height: SPACING.xl, backgroundColor: first ? 'transparent' : c.vividTeal },
                ]}
              />
              {first || last ? (
                <View style={[styles.node, { backgroundColor: c.vividTeal }]} />
              ) : (
                <View
                  style={[styles.ring, { borderColor: c.vividTeal, backgroundColor: c.bg }]}
                />
              )}
              <View
                style={[
                  styles.railLine,
                  styles.grow,
                  { backgroundColor: last ? 'transparent' : c.vividTeal },
                ]}
              />
            </View>

            <View style={[styles.grow, !last && styles.gap]}>
              <Touch
                onPress={() => onOpen(ev.id)}
                dim={0.85}
                style={[styles.event, { backgroundColor: fill }, s.colored(fill)]}
                accessibilityRole="button"
                accessibilityLabel={`${ev.title}, ${ev.time}`}
              >
                <Txt weight={600} style={[TYPE.subtitle, { color: fg }]}>
                  {ev.title}
                </Txt>
                <Txt
                  weight={ev.tone === 'amber' ? 500 : 400}
                  style={[TYPE.caption, styles.subtitle, { color: fg }]}
                >
                  {ev.subtitle}
                </Txt>

                <View style={styles.foot}>
                  <View style={styles.time}>
                    <Icon name="clock" size={ms(14)} color={fg} strokeWidth={2} />
                    <Txt weight={500} style={[TYPE.caption, { color: fg }]}>
                      {ev.time}
                    </Txt>
                  </View>

                  {!!ev.avatars && (
                    <AvatarStack overlap={ms(9)}>
                      {ev.avatars.map((a) => (
                        <Avatar
                          key={a.label}
                          label={a.label}
                          size={AVATAR.xs}
                          bg={a.bg ?? 'rgba(255,255,255,0.28)'}
                          color={fg}
                          fontSize={TYPE.nano.fontSize}
                          ring={fill}
                        />
                      ))}
                    </AvatarStack>
                  )}
                </View>
              </Touch>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.md },
  grow: { flex: 1, minWidth: 0 },
  railTime: { width: RAIL_TIME_WIDTH, paddingTop: SPACING.md },
  rail: { width: RAIL_WIDTH, alignItems: 'center' },
  railLine: { width: 2, borderRadius: 1 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2 },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3 },
  gap: { paddingBottom: SPACING.md },

  event: { padding: SPACING.lg, borderRadius: RADIUS.card },
  subtitle: { marginTop: SPACING.xxs / 2 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  time: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexShrink: 1 },
});
