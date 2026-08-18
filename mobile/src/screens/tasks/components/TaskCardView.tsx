import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  AvatarStack,
  Icon,
  IconWell,
  ProgressBar,
  Touch,
  Txt,
} from '../../../components/ui';
import type { TaskCard } from '../../../models/view';
import { AVATAR, ON_ACCENT, RADIUS, SPACING, TYPE, ms, useTheme } from '../../../theme';

const CHECK = ms(24);

/** One task: a check-off target, its owner, and how far along it is. */
export function TaskCardView({
  task,
  done,
  percent,
  onToggle,
}: {
  task: TaskCard;
  done: boolean;
  percent: number;
  onToggle: () => void;
}) {
  const { c, s } = useTheme();

  return (
    <Touch
      onPress={onToggle}
      dim={0.7}
      style={[styles.card, { backgroundColor: c.card }, s.card]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={task.title}
    >
      <View style={styles.row}>
        {done ? (
          <View style={[styles.check, { backgroundColor: c.vividTeal }]}>
            <Icon name="check" size={ms(14)} color={ON_ACCENT} strokeWidth={3} />
          </View>
        ) : (
          <View style={[styles.check, styles.checkOff, { borderColor: c.check }]} />
        )}

        <View style={styles.grow}>
          <Txt weight={600} style={[TYPE.subtitle, { color: c.ink }]}>
            {task.title}
          </Txt>
          <View style={styles.metaRow}>
            <Icon name="clock" size={ms(14)} color={c.faint} />
            <Txt numberOfLines={1} style={[TYPE.caption, styles.grow, { color: c.faint }]}>
              {task.meta}
            </Txt>
          </View>
        </View>

        <View style={styles.owners}>
          <AvatarStack overlap={ms(10)}>
            <Avatar
              label={task.owner.initials}
              size={AVATAR.sm}
              bg={c[task.owner.bg]}
              fontSize={TYPE.nano.fontSize}
              ring={c.card}
            />
            <IconWell
              icon="plus"
              size={AVATAR.sm}
              shape="circle"
              bg={c.chip}
              fg={c.ink3}
              ratio={0.46}
              style={[styles.addPerson, { borderColor: c.card }]}
            />
          </AvatarStack>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Txt style={[TYPE.caption, { color: c.ink3 }]}>Progress</Txt>
        <Txt weight={600} style={[TYPE.bodySm, { color: c.ink }]}>
          {percent}%
        </Txt>
      </View>
      <ProgressBar
        value={percent / 100}
        color={c[task.bar]}
        style={styles.track}
        accessibilityLabel={`${task.title} progress`}
      />
    </Touch>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: RADIUS.cardLg },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },

  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK * 0.375,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOff: { borderWidth: 2 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  owners: { marginTop: 2 },
  addPerson: { borderWidth: 2 },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  track: { marginTop: SPACING.sm },
});
