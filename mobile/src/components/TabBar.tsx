import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { useApp } from '../store/AppStore';
import type { TabName } from '../navigation/types';
import { Icon, IconName } from './Icon';
import { Touch, Txt } from './primitives';

/** Height of the bar itself, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 74;

const TABS: { name: TabName; label: string; on: IconName; off: IconName }[] = [
  { name: 'Home', label: 'Home', on: 'homeFill', off: 'homeOutline' },
  { name: 'Calendar', label: 'Calendar', on: 'calendarFill', off: 'calendar' },
  { name: 'Chats', label: 'Chats', on: 'chatFill', off: 'chatOutline' },
  { name: 'Tasks', label: 'Tasks', on: 'taskFill', off: 'taskOutline' },
  { name: 'Profile', label: 'Profile', on: 'profileFill', off: 'profileOutline' },
];

/**
 * The evenly-spaced five-tab bar. Active tabs take the solid glyph and teal
 * label; the rest stay outlined and grey. Chats carries the unread count.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { msgCount } = useApp();

  return (
    <View
      style={[
        styles.bar,
        s.tabBar,
        { backgroundColor: c.chrome, paddingBottom: 8 + insets.bottom },
      ]}
    >
      {TABS.map((tab, index) => {
        const focused = state.index === index;

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

        const badge = tab.name === 'Chats' && msgCount > 0;

        return (
          <Touch
            key={tab.name}
            onPress={onPress}
            style={styles.tab}
            dim={0.6}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              badge ? `${tab.label}, ${msgCount} waiting` : tab.label
            }
          >
            <View>
              <Icon
                name={focused ? tab.on : tab.off}
                size={22}
                color={focused ? c.tealFill : c.nav}
              />
              {badge && (
                <View style={[styles.badge, { backgroundColor: c.vividRose }]}>
                  <Txt weight={600} style={styles.badgeText}>
                    {msgCount}
                  </Txt>
                </View>
              )}
            </View>
            <Txt
              weight={focused ? 600 : 500}
              style={[styles.label, { color: focused ? c.teal : c.nav }]}
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
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 16,
    minHeight: 56,
  },
  label: { fontSize: 10 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9.5, color: '#ffffff' },
});
