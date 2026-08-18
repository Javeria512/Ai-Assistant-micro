import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SHEET_RATIO } from '../../constants';
import { useApp } from '../../store';
import { ICON_WELL, RADIUS, SPACING, TYPE, useTheme } from '../../theme';
import { countOf } from '../../utils';
import { IconWell, Txt } from '../ui';
import { Sheet, SheetHeader } from './Sheet';

/** The "Smart reminders" sheet behind the app bar's menu button. */
export function AlertsSheet() {
  const { c, s } = useTheme();
  const { overlay, closeOverlay, vm } = useApp();
  const reminders = vm?.reminders ?? [];

  const tint = {
    rose: { bg: c.roseSoft, fg: c.rose },
    teal: { bg: c.tealSoft, fg: c.teal },
    peri: { bg: c.periSoft, fg: c.peri },
  };

  return (
    <Sheet
      visible={overlay?.kind === 'alerts'}
      onClose={closeOverlay}
      maxHeightRatio={SHEET_RATIO.alerts}
    >
      <SheetHeader
        title="Smart reminders"
        meta={
          reminders.length
            ? `${countOf(reminders.length, 'thing')} I surfaced for you`
            : 'Nothing needs you right now'
        }
        onClose={closeOverlay}
      />
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {reminders.map((r) => (
          <View key={r.title} style={[styles.item, { backgroundColor: c.card }, s.soft]}>
            <IconWell
              icon={r.icon}
              size={ICON_WELL.lg}
              bg={tint[r.tone].bg}
              fg={tint[r.tone].fg}
              ratio={0.47}
            />
            <View style={styles.text}>
              <Txt weight={600} style={[TYPE.bodyLg, { color: c.ink }]}>
                {r.title}
              </Txt>
              <Txt style={[TYPE.caption, styles.meta, { color: c.ink3 }]}>{r.meta}</Txt>
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  item: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.card,
  },
  text: { flex: 1, minWidth: 0 },
  meta: { marginTop: SPACING.xxs / 2 },
});
