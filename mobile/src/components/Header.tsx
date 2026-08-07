import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { useApp } from '../store/AppStore';
import type { TabParamList } from '../navigation/types';
import { Avatar, Touch, Txt } from './primitives';

/**
 * The app bar: a two-rule menu button that opens smart reminders, a centred
 * title, and the user's avatar as a shortcut to Profile.
 */
export function Header({ title }: { title: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { openAlerts, vm } = useApp();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.bg, paddingTop: insets.top + 14 },
      ]}
    >
      <Touch
        onPress={openAlerts}
        style={styles.menu}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Smart reminders"
      >
        <View style={[styles.rule, { width: 22, backgroundColor: c.ink }]} />
        <View style={[styles.rule, { width: 15, backgroundColor: c.ink }]} />
      </Touch>

      <Txt weight={600} numberOfLines={1} style={[styles.title, { color: c.ink }]}>
        {title}
      </Txt>

      <Touch
        onPress={() => navigation.navigate('Profile')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Your profile"
      >
        <Avatar
          label={vm?.user.initials ?? '··'}
          size={40}
          bg={c.periFill}
          fontSize={13.5}
        />
      </Touch>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  menu: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    gap: 5,
  },
  rule: { height: 2.4, borderRadius: 2 },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontSize: 17,
    letterSpacing: -0.17,
  },
});
