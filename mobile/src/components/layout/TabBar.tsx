import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useResponsive } from '../../hooks';
import type { TabName } from '../../navigation/types';
import { useApp } from '../../store';
import { SPACING, TYPE, ms, useTheme } from '../../theme';
import { Badge, Icon, Touch, Txt, type IconName } from '../ui';

const TABS: { name: TabName; label: string; on: IconName; off: IconName }[] = [
  { name: 'Home', label: 'Home', on: 'homeFill', off: 'homeOutline' },
  { name: 'Calendar', label: 'Calendar', on: 'calendarFill', off: 'calendar' },
  { name: 'Chats', label: 'Chats', on: 'chatFill', off: 'chatOutline' },
  { name: 'Tasks', label: 'Tasks', on: 'taskFill', off: 'taskOutline' },
  { name: 'Profile', label: 'Profile', on: 'profileFill', off: 'profileOutline' },
];

const ICON = ms(22);

/**
 * The evenly-spaced five-tab bar. Active tabs take the solid glyph and teal
 * label; the rest stay outlined and grey. Chats carries the unread count.
 *
 * Landscape puts the icon and label side by side instead of stacked: there is
 * plenty of width and almost no height, so the stacked form ate a sixth of the
 * screen.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLandscape } = useResponsive();
  const { msgCount } = useApp();

  return (
    <View
      style={[
        styles.bar,
        s.tabBar,
        {
          backgroundColor: c.chrome,
          paddingTop: isLandscape ? SPACING.xs : SPACING.sm,
          paddingBottom: (isLandscape ? SPACING.xs : SPACING.sm) + insets.bottom,
          paddingLeft: SPACING.sm + insets.left,
          paddingRight: SPACING.sm + insets.right,
        },
      ]}
    >
      {TABS.map((tab, index) => {
        const focused = state.index === index;
        const badge = tab.name === 'Chats' && msgCount > 0;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[index].key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(state.routes[index].name);
          }
        };

        return (
          <Touch
            key={tab.name}
            onPress={onPress}
            dim={0.6}
            style={[styles.tab, isLandscape && styles.tabLandscape]}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${tab.label}, ${msgCount} waiting` : tab.label}
          >
            <View>
              <Icon
                name={focused ? tab.on : tab.off}
                size={ICON}
                color={focused ? c.tealFill : c.nav}
              />
              {badge && <Badge count={msgCount} />}
            </View>
            <Txt
              weight={focused ? 600 : 500}
              numberOfLines={1}
              // The label is the first thing to break on a 320pt screen at
              // large system text; shrinking beats truncating "Calendar".
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[TYPE.nano, styles.label, { color: focused ? c.teal : c.nav }]}
            >
              {tab.label}
            </Txt>
          </Touch>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 2,
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xxs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 2,
    borderRadius: ms(16),
    minHeight: ms(52),
  },
  tabLandscape: { flexDirection: 'row', gap: SPACING.xs, minHeight: ms(40) },
  label: { textAlign: 'center' },
});
