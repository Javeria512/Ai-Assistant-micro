import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, IconWell, Touch, Txt, type IconName } from '../../../components/ui';
import { ICON_WELL, SPACING, TYPE, ms, useTheme } from '../../../theme';

const SWITCH_W = ms(48);
const SWITCH_H = ms(28);
const KNOB = ms(22);

/** One row in the preferences card: tinted icon, label, and a trailing control. */
export function PreferenceRow({
  icon,
  tint,
  fg,
  label,
  divider,
  onPress,
  trailing,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  icon: IconName;
  tint: string;
  fg: string;
  label: string;
  divider?: boolean;
  onPress?: () => void;
  trailing?: React.ReactNode;
  accessibilityRole?: 'button' | 'switch';
  accessibilityState?: { checked?: boolean };
}) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      dim={0.65}
      style={[
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
      ]}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
    >
      <IconWell icon={icon} size={ICON_WELL.md} bg={tint} fg={fg} />
      <Txt weight={500} style={[TYPE.body, styles.label, { color: c.ink }]}>
        {label}
      </Txt>
      {trailing ?? <Icon name="chevronRight" size={ms(17)} color={c.faint} />}
    </Touch>
  );
}

/** The design's own switch — RN's `Switch` cannot take these colours on Android. */
export function ToggleTrack({ on }: { on: boolean }) {
  const { c, s } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: on ? c.switchTrack : c.check }]}>
      <View
        style={[styles.knob, s.thumb, { left: on ? SWITCH_W - KNOB - 3 : 3 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  label: { flex: 1, minWidth: 0 },
  track: {
    width: SWITCH_W,
    height: SWITCH_H,
    borderRadius: SWITCH_H / 2,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#ffffff',
  },
});
