import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS, clamp, ms, useTheme } from '../../theme';

const TRACK_HEIGHT = ms(6);
const THUMB = ms(12);

export type ProgressBarProps = {
  /** 0–1; values outside are clamped rather than overflowing the track. */
  value: number;
  color: string;
  /** The ringed dot riding the fill's leading edge. */
  thumb?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** The 6pt progress track used on task and message cards. */
export function ProgressBar({
  value,
  color,
  thumb = true,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const { c, s } = useTheme();
  const ratio = clamp(value, 0, 1);
  const pct = `${ratio * 100}%` as const;

  return (
    <View
      style={[styles.track, { height: TRACK_HEIGHT, backgroundColor: c.track }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <View style={[styles.fill, { height: TRACK_HEIGHT, width: pct, backgroundColor: color }]} />
      {thumb && (
        <View
          style={[
            styles.thumb,
            s.thumb,
            {
              left: pct,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              marginLeft: -THUMB / 2,
              top: (TRACK_HEIGHT - THUMB) / 2,
              backgroundColor: color,
              borderColor: c.card,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: RADIUS.pill, overflow: 'visible' },
  fill: { borderRadius: RADIUS.pill },
  thumb: { position: 'absolute', borderWidth: 2.5 },
});
