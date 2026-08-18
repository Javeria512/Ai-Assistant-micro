import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SHEET_RATIO } from '../../constants';
import type { SheetContent } from '../../models/view';
import { useApp } from '../../store';
import { ICON_WELL, RADIUS, SPACING, TYPE, useTheme } from '../../theme';
import { Bullet, Button, Icon, IconWell, Kicker, Txt } from '../ui';
import { Sheet, SheetHeader } from './Sheet';

/**
 * The shared detail sheet for both a message and a calendar event: an AI
 * explainer panel, an optional draft reply, and a two-button action row.
 *
 * The last-shown content is held while the sheet animates out so the body does
 * not blank mid-dismiss.
 */
export function DetailSheet() {
  const { c, s } = useTheme();
  const { overlay, closeOverlay, confirmSheet, vm } = useApp();

  const live: SheetContent | null =
    overlay?.kind === 'detail' ? (vm?.sheets[overlay.key] ?? null) : null;

  const last = React.useRef<SheetContent | null>(null);
  if (live) last.current = live;
  const content = live ?? last.current;

  if (!content) return null;

  return (
    <Sheet
      visible={!!live}
      onClose={closeOverlay}
      maxHeightRatio={SHEET_RATIO.detail}
      footer={
        <>
          <Button
            label={content.secondary}
            onPress={closeOverlay}
            variant="secondary"
            size="md"
            grow
          />
          <Button
            label={content.primary}
            onPress={confirmSheet}
            variant="primary"
            size="md"
            grow={1.4}
          />
        </>
      }
    >
      <SheetHeader
        title={content.title}
        meta={content.meta}
        onClose={closeOverlay}
        titleStyle={TYPE.h3}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.explainer, { backgroundColor: c.tealSoft }]}>
          <View style={styles.explainerHead}>
            <IconWell
              icon="sparkle"
              size={ICON_WELL.sm}
              bg={c.vividTeal}
              fg="#ffffff"
              ratio={0.55}
            />
            <Kicker color={c.teal}>{content.kicker}</Kicker>
          </View>

          {content.points.map((p) => (
            <Bullet key={p} text={p} dot={c.vividTeal} color={c.ink} />
          ))}

          <View style={[styles.sourceRow, { borderTopColor: c.tealLine }]}>
            <Icon name="doc" size={TYPE.micro.fontSize} color={c.teal} strokeWidth={1.9} />
            <Txt style={[TYPE.micro, styles.source, { color: c.teal }]}>
              {content.source}
            </Txt>
          </View>
        </View>

        {content.hasReply && !!content.reply && (
          <View style={[styles.draft, { backgroundColor: c.card }, s.soft]}>
            <Kicker color={c.faint}>Draft reply</Kicker>
            <Txt style={[TYPE.bodyMd, styles.draftText, { color: c.ink }]}>
              {content.reply}
            </Txt>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg, gap: SPACING.md },

  explainer: { padding: SPACING.lg, borderRadius: RADIUS.card },
  explainerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xxs / 2,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  source: { flex: 1, minWidth: 0 },

  draft: { padding: SPACING.lg, borderRadius: RADIUS.card },
  draftText: { marginTop: SPACING.sm },
});
