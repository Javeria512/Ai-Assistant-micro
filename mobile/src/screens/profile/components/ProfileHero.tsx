import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../../../components/ui';
import type { UserHeader } from '../../../models/view';
import { AVATAR, ON_ACCENT, RADIUS, SPACING, TYPE, useTheme } from '../../../theme';
import { countOf } from '../../../utils';

/** Identity card: avatar, name, role, and what is connected. */
export function ProfileHero({
  user,
  connectedCount,
}: {
  user: UserHeader;
  connectedCount: number;
}) {
  const { c, s } = useTheme();

  return (
    <View style={[styles.hero, { backgroundColor: c.tealFill }, s.colored(c.tealFill)]}>
      <View style={styles.avatar}>
        <Txt weight={600} style={[TYPE.h1, styles.onFill]}>
          {user.initials}
        </Txt>
      </View>

      <View style={styles.text}>
        <Txt weight={700} style={[TYPE.h2, styles.centered, styles.onFill]}>
          {user.name}
        </Txt>
        {!!user.role && (
          <Txt style={[TYPE.bodyMd, styles.centered, styles.onFill]}>{user.role}</Txt>
        )}
      </View>

      <View style={styles.tags}>
        <View style={styles.tag}>
          <Txt weight={500} numberOfLines={1} style={[TYPE.caption, styles.onFill]}>
            {countOf(connectedCount, 'source')} synced
          </Txt>
        </View>
        <View style={[styles.tag, { backgroundColor: c.card }]}>
          <Txt weight={600} numberOfLines={1} style={[TYPE.caption, { color: c.teal }]}>
            Microsoft 365
          </Txt>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.hero,
  },
  avatar: {
    width: AVATAR.xl,
    height: AVATAR.xl,
    borderRadius: AVATAR.xl / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { alignItems: 'center', alignSelf: 'stretch' },
  centered: { textAlign: 'center' },
  onFill: { color: ON_ACCENT },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.sm },
  tag: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    flexShrink: 1,
  },
});
