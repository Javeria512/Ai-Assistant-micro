import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useResponsive } from '../../hooks';
import type { TabParamList } from '../../navigation/types';
import { useApp } from '../../store';
import { AVATAR, HIT_SLOP, SPACING, TYPE, ms, useTheme } from '../../theme';
import { Avatar, Touch, Txt } from '../ui';

/** Width reserved on each side of the title so the title stays optically centred. */
const SIDE_SLOT = AVATAR.lg;

/**
 * The app bar: a two-rule menu button that opens smart reminders, a centred
 * title, and the user's avatar as a shortcut to Profile.
 *
 * Both side slots are the same fixed width. Previously the menu button was 34pt
 * and the avatar 40pt, so a `flex: 1` title sat 3pt off centre on every screen.
 */
export function Header({ title }: { title: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLandscape, gutter } = useResponsive();
  const { openAlerts, vm } = useApp();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.bg,
          // Landscape has far less height to spare, so the bar tightens up.
          paddingTop: insets.top + (isLandscape ? SPACING.sm : SPACING.md),
          paddingBottom: isLandscape ? SPACING.sm : SPACING.md,
          paddingLeft: gutter + insets.left,
          paddingRight: gutter + insets.right,
        },
      ]}
    >
      <View style={styles.slot}>
        <Touch
          onPress={openAlerts}
          style={styles.menu}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Smart reminders"
        >
          <View style={[styles.rule, { width: ms(22), backgroundColor: c.ink }]} />
          <View style={[styles.rule, { width: ms(15), backgroundColor: c.ink }]} />
        </Touch>
      </View>

      <Txt weight={600} numberOfLines={1} style={[TYPE.h5, styles.title, { color: c.ink }]}>
        {title}
      </Txt>

      <View style={[styles.slot, styles.slotEnd]}>
        <Touch
          onPress={() => navigation.navigate('Profile')}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
        >
          <Avatar
            label={vm?.user.initials ?? '··'}
            size={AVATAR.lg}
            bg={c.periFill}
            fontSize={TYPE.caption.fontSize}
          />
        </Touch>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  slot: { width: SIDE_SLOT, alignItems: 'flex-start' },
  slotEnd: { alignItems: 'flex-end' },
  menu: {
    width: ms(34),
    height: ms(34),
    justifyContent: 'center',
    gap: ms(5),
  },
  rule: { height: 2.4, borderRadius: 2 },
  title: { flex: 1, minWidth: 0, textAlign: 'center' },
});
