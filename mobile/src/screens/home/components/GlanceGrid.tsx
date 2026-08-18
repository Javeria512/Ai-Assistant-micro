import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '../../../hooks';
import { ICON_WELL, ON_ACCENT, RADIUS, SPACING, TYPE, useTheme } from '../../../theme';
import { Icon, IconWell, Touch, Txt, type IconName } from '../../../components/ui';

export type GlanceTileSpec = {
  key: string;
  icon: IconName;
  title: string;
  detail: string;
  bg: string;
  /** Ink on the fill; amber needs a dark one to stay legible. */
  fg?: string;
  /** Wash behind the tile's glyph. */
  tint?: string;
  detailWeight?: 400 | 500;
  onPress: () => void;
};

/**
 * The saturated shortcut tiles under "Today at a glance".
 *
 * Two across upright. Once the content column is wide enough — a tablet, or a
 * phone on its side — all four go on one row instead, which is the difference
 * between a landscape Home screen that is all tiles and one you can actually
 * scroll past.
 */
export function GlanceGrid({ tiles }: { tiles: GlanceTileSpec[] }) {
  const { glanceColumns } = useResponsive();

  if (glanceColumns === 4) {
    return (
      <View style={styles.row}>
        {tiles.map(({ key, ...tile }) => (
          <GlanceTile key={key} {...tile} />
        ))}
      </View>
    );
  }

  // Chunk into rows of two rather than relying on `flexWrap`, which cannot give
  // the two tiles in a row equal heights.
  const rows = [tiles.slice(0, 2), tiles.slice(2)];
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map(({ key, ...tile }) => (
            <GlanceTile key={key} {...tile} />
          ))}
        </View>
      ))}
    </View>
  );
}

function GlanceTile({
  icon,
  title,
  detail,
  bg,
  fg = ON_ACCENT,
  tint = 'rgba(255,255,255,0.22)',
  detailWeight = 400,
  onPress,
}: Omit<GlanceTileSpec, 'key'>) {
  const { s } = useTheme();
  return (
    <Touch
      onPress={onPress}
      dim={0.85}
      style={[styles.tile, { backgroundColor: bg }, s.colored(bg)]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
    >
      <IconWell icon={icon} size={ICON_WELL.lg} bg={tint} fg={fg} />
      <Txt weight={700} numberOfLines={1} style={[TYPE.h3, styles.title, { color: fg }]}>
        {title}
      </Txt>
      <View style={styles.foot}>
        <Txt
          weight={detailWeight}
          numberOfLines={1}
          style={[TYPE.bodySm, styles.detail, { color: fg }]}
        >
          {detail}
        </Txt>
        <Icon name="arrowRight" size={TYPE.h3.fontSize} color={fg} />
      </View>
    </Touch>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  tile: {
    flex: 1,
    minWidth: 0,
    padding: SPACING.lg,
    borderRadius: RADIUS.card,
    justifyContent: 'space-between',
  },
  // The design leaves a deliberate gap between the icon well and the title.
  title: { marginTop: SPACING.xxl },
  foot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xxs / 2,
  },
  detail: { flexShrink: 1 },
});
