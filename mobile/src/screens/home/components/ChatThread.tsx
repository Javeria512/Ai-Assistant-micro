import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FadeUp, TypingDots } from '../../../components/animations';
import { Icon, IconWell, Kicker, Txt } from '../../../components/ui';
import type { ChatMessage } from '../../../store';
import {
  ICON_WELL,
  ON_ACCENT,
  RADIUS,
  SPACING,
  TYPE,
  useTheme,
} from '../../../theme';

/** The tail on a speech bubble: one corner stays tight. */
const TAIL = SPACING.xs;

/** The question-and-answer thread beneath the composer. */
export function ChatThread({
  messages,
  typing,
}: {
  messages: ChatMessage[];
  typing: boolean;
}) {
  const { c, s } = useTheme();

  return (
    <>
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <FadeUp key={i} style={styles.userRow}>
            <View style={[styles.userBubble, { backgroundColor: c.periFill }]}>
              <Txt style={[TYPE.bodyMd, styles.userText]}>{m.text}</Txt>
            </View>
          </FadeUp>
        ) : (
          <FadeUp key={i}>
            <View style={[styles.aiCard, { backgroundColor: c.card }, s.card]}>
              <View style={styles.aiHead}>
                <IconWell
                  icon="sparkle"
                  size={ICON_WELL.sm}
                  bg={c.vividTeal}
                  fg={ON_ACCENT}
                  ratio={0.55}
                />
                <Kicker color={c.teal}>Assistant</Kicker>
              </View>
              <Txt style={[TYPE.bodyMd, { color: c.ink }]}>{m.text}</Txt>
              {!!m.source && (
                <View style={[styles.aiFoot, { borderTopColor: c.line }]}>
                  <Icon name="doc" size={TYPE.micro.fontSize} color={c.faint} />
                  <Txt style={[TYPE.micro, styles.aiSource, { color: c.faint }]}>
                    {m.source}
                  </Txt>
                </View>
              )}
            </View>
          </FadeUp>
        ),
      )}

      {typing && <TypingDots />}
    </>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopLeftRadius: RADIUS.cardLg,
    borderTopRightRadius: RADIUS.cardLg,
    borderBottomRightRadius: TAIL,
    borderBottomLeftRadius: RADIUS.cardLg,
  },
  userText: { color: ON_ACCENT },

  aiCard: {
    padding: SPACING.lg,
    borderTopLeftRadius: RADIUS.cardLg,
    borderTopRightRadius: RADIUS.cardLg,
    borderBottomRightRadius: RADIUS.cardLg,
    borderBottomLeftRadius: TAIL,
  },
  aiHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  aiFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  aiSource: { flex: 1, minWidth: 0 },
});
