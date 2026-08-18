import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS, useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';

export type IconWellProps = {
  icon: IconName;
  /** Edge length of the square. */
  size: number;
  /** Tint behind the glyph. Defaults to the neutral chip fill. */
  bg?: string;
  /** Glyph colour. */
  fg: string;
  /** Fraction of `size` the glyph occupies — the design's ratio is about half. */
  ratio?: number;
  /** `'squircle'` follows the tile radius; `'circle'` is fully round. */
  shape?: 'squircle' | 'circle';
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The tinted rounded square that sits behind a glyph — glance tiles, preference
 * rows, reminder items, empty states. It appeared ten times as ten hand-written
 * `{ width, height, borderRadius, alignItems, justifyContent }` blocks.
 */
export function IconWell({
  icon,
  size,
  bg,
  fg,
  ratio = 0.5,
  shape = 'squircle',
  strokeWidth,
  style,
}: IconWellProps) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.well,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : Math.min(RADIUS.tile, size * 0.34),
          backgroundColor: bg ?? c.chip,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * ratio)} color={fg} strokeWidth={strokeWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  well: { alignItems: 'center', justifyContent: 'center' },
});
