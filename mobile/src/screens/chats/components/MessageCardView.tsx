import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Icon,
  IconButton,
  Kicker,
  ProgressBar,
  Tag,
  Touch,
  Txt,
} from '../../../components/ui';
import type { MessageCard, Tone } from '../../../models/view';
import { AVATAR, RADIUS, SPACING, TYPE, ms, useTheme } from '../../../theme';

/** One message: who it is from, how urgent, what the assistant suggests. */
export function MessageCardView({
  message,
  onOpen,
  onReply,
  onSnooze,
}: {
  message: MessageCard;
  onOpen: () => void;
  onReply: () => void;
  onSnooze: () => void;
}) {
  const { c, s } = useTheme();

  const tagColors = (tone: Tone) =>
    tone === 'rose'
      ? { bg: c.roseSoft, fg: c.rose }
      : tone === 'amber'
        ? { bg: c.amberSoft, fg: c.amber }
        : { bg: c.chip, fg: c.ink2 };

  const tag = tagColors(message.priority.tone);

  return (
    <View style={[styles.card, { backgroundColor: c.card }, s.card]}>
      <Touch
        onPress={onOpen}
        dim={0.65}
        style={styles.head}
        accessibilityRole="button"
        accessibilityLabel={`Open ${message.title}`}
      >
        <View style={styles.grow}>
          <Txt weight={600} style={[TYPE.subtitle, { color: c.ink }]}>
            {message.title}
          </Txt>
          <View style={styles.metaRow}>
            <Icon name="clock" size={ms(14)} color={c.faint} />
            <Txt numberOfLines={1} style={[TYPE.caption, styles.grow, { color: c.faint }]}>
              {message.meta}
            </Txt>
          </View>
        </View>
        <Avatar
          label={message.initials}
          size={AVATAR.md}
          bg={c[message.avatar]}
          fontSize={TYPE.caption.fontSize}
        />
      </Touch>

      <View style={styles.statusRow}>
        <Tag label={message.priority.label} bg={tag.bg} color={tag.fg} />
        <Txt weight={600} numberOfLines={1} style={[TYPE.caption, { color: c.ink3 }]}>
          {message.deadline}
        </Txt>
      </View>

      <ProgressBar
        value={message.progress}
        color={c[message.bar]}
        style={styles.track}
        accessibilityLabel={`${message.priority.label} ranking`}
      />

      {!!message.suggestion && (
        <View style={[styles.suggestion, { backgroundColor: c.tealSoft }]}>
          <Kicker color={c.teal}>AI suggestion</Kicker>
          <Txt style={[TYPE.bodySm, styles.suggestionText, { color: c.ink }]}>
            {message.suggestion}
          </Txt>
        </View>
      )}

      <View style={styles.actions}>
        <Button label="Reply with AI" onPress={onReply} grow={1.3} />
        <Button label="Open" onPress={onOpen} variant="secondary" grow />
        <IconButton
          icon="clock"
          onPress={onSnooze}
          accessibilityLabel="Snooze for an hour"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: RADIUS.cardLg },
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  track: { marginTop: SPACING.sm },
  suggestion: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.chip,
  },
  suggestionText: { marginTop: SPACING.xs },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
