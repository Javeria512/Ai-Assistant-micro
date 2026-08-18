import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AVATAR, ON_ACCENT, type Weight } from '../../theme';
import { Txt } from './Txt';

export type AvatarProps = {
  label: string;
  size?: number;
  bg: string;
  color?: string;
  fontSize?: number;
  /** Border colour, for stacked avatars that overlap. */
  ring?: string;
  weight?: Weight;
};

/** A round initials chip. Sizes come from `AVATAR` so they scale with the screen. */
export function Avatar({
  label,
  size = AVATAR.md,
  bg,
  color = ON_ACCENT,
  fontSize,
  ring,
  weight = 600,
}: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring ? [styles.ring, { borderColor: ring }] : null,
      ]}
    >
      <Txt
        weight={weight}
        numberOfLines={1}
        style={{ fontSize: fontSize ?? size * 0.33, color }}
      >
        {label}
      </Txt>
    </View>
  );
}

/** Overlapping avatar row, as used on event and task cards. */
export function AvatarStack({
  children,
  overlap = 10,
}: {
  children: React.ReactNode;
  overlap?: number;
}) {
  const items = React.Children.toArray(children);
  return (
    <View style={styles.row}>
      {items.map((child, i) => (
        <View key={i} style={i === 0 ? null : { marginLeft: -overlap }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { borderWidth: 2 },
});
