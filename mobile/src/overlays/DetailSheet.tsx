import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import type { SheetContent } from '../data/content';
import { Icon } from '../components/Icon';
import { Sheet, SheetHeader } from '../components/Sheet';
import { Bullet, Kicker, Touch, Txt } from '../components/primitives';

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
      maxHeightRatio={0.84}
      footer={
        <>
          <Touch
            onPress={closeOverlay}
            style={[styles.secondary, { backgroundColor: c.chip }]}
            accessibilityRole="button"
          >
            <Txt weight={600} style={[styles.btnText, { color: c.ink2 }]}>
              {content.secondary}
            </Txt>
          </Touch>
          <Touch
            onPress={confirmSheet}
            dim={0.85}
            style={[
              styles.primary,
              { backgroundColor: c.tealFill },
              s.colored(c.tealFill),
            ]}
            accessibilityRole="button"
          >
            <Txt weight={600} style={[styles.btnText, { color: '#ffffff' }]}>
              {content.primary}
            </Txt>
          </Touch>
        </>
      }
    >
      <SheetHeader
        title={content.title}
        meta={content.meta}
        onClose={closeOverlay}
        titleSize={19}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.explainer, { backgroundColor: c.tealSoft }]}>
          <View style={styles.explainerHead}>
            <View style={[styles.mark, { backgroundColor: c.vividTeal }]}>
              <Icon name="sparkle" size={12} color="#ffffff" />
            </View>
            <Kicker color={c.teal}>{content.kicker}</Kicker>
          </View>

          {content.points.map((p) => (
            <Bullet key={p} text={p} dot={c.vividTeal} color={c.ink} />
          ))}

          <View style={[styles.sourceRow, { borderTopColor: c.tealLine }]}>
            <Icon name="doc" size={12} color={c.teal} strokeWidth={1.9} />
            <Txt style={[styles.source, { color: c.teal }]}>{content.source}</Txt>
          </View>
        </View>

        {content.hasReply && content.reply && (
          <View style={[styles.draft, { backgroundColor: c.card }, s.soft]}>
            <Kicker color={c.faint}>Draft reply</Kicker>
            <Txt style={[styles.draftText, { color: c.ink }]}>{content.reply}</Txt>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },

  explainer: { padding: 17, borderRadius: RADIUS.card },
  explainerHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 11 },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    paddingTop: 11,
    borderTopWidth: 1,
  },
  source: { flex: 1, fontSize: 11 },

  draft: { padding: 16, borderRadius: RADIUS.card },
  draftText: { fontSize: 13.5, lineHeight: 21.6, marginTop: 9 },

  secondary: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    flex: 1.4,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14 },
});
