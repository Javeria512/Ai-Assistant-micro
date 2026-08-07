import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { Icon } from '../components/Icon';
import { Sheet, SheetHeader } from '../components/Sheet';
import { Txt } from '../components/primitives';

/** The "Smart reminders" sheet behind the menu button. */
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
      maxHeightRatio={0.72}
    >
      <SheetHeader
        title="Smart reminders"
        meta={
          reminders.length
            ? `${reminders.length} thing${reminders.length === 1 ? '' : 's'} I surfaced for you`
            : 'Nothing needs you right now'
        }
        onClose={closeOverlay}
      />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {reminders.map((r) => (
          <View
            key={r.title}
            style={[styles.item, { backgroundColor: c.card }, s.soft]}
          >
            <View style={[styles.icon, { backgroundColor: tint[r.tone].bg }]}>
              <Icon name={r.icon} size={18} color={tint[r.tone].fg} />
            </View>
            <View style={styles.text}>
              <Txt weight={600} style={[styles.title, { color: c.ink }]}>
                {r.title}
              </Txt>
              <Txt style={[styles.meta, { color: c.ink3 }]}>{r.meta}</Txt>
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 11 },
  item: {
    flexDirection: 'row',
    gap: 13,
    padding: 15,
    borderRadius: RADIUS.card,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, lineHeight: 20.3 },
  meta: { fontSize: 12, marginTop: 3 },
});
