import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { FONT, RADIUS } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/* ── Text ─────────────────────────────────────────────────────────── */

const FAMILY = {
  400: FONT.regular,
  500: FONT.medium,
  600: FONT.semibold,
  700: FONT.bold,
} as const;

export type Weight = keyof typeof FAMILY;

/**
 * Text with the right Poppins face for the weight. React Native will not
 * synthesise weights for a custom font, so weight must select a family.
 */
export function Txt({
  weight = 400,
  style,
  ...rest
}: TextProps & { weight?: Weight }) {
  return <Text {...rest} style={[{ fontFamily: FAMILY[weight] }, style]} />;
}

/* ── Pressable ────────────────────────────────────────────────────── */

/**
 * The design expressed affordance with hover (brightness / lift). Touch has no
 * hover, so the same intent becomes a press-down dim.
 */
export function Touch({
  style,
  dim = 0.72,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Opacity while held. */
  dim?: number;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && !rest.disabled && { opacity: dim }]}
    >
      {children}
    </Pressable>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */

/** The standard white 18–20px card with a wide, diffuse shadow. */
export function Card({
  style,
  children,
  soft = false,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Use the quieter one-layer shadow. */
  soft?: boolean;
}) {
  const { c, s } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.card, borderRadius: RADIUS.cardLg },
        soft ? s.soft : s.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ── Avatars ──────────────────────────────────────────────────────── */

export function Avatar({
  label,
  size = 38,
  bg,
  color = '#ffffff',
  fontSize,
  ring,
  weight = 600,
}: {
  label: string;
  size?: number;
  bg: string;
  color?: string;
  fontSize?: number;
  /** Border colour, for stacked avatars that overlap. */
  ring?: string;
  weight?: Weight;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}
    >
      <Txt weight={weight} style={{ fontSize: fontSize ?? size * 0.33, color }}>
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

/* ── Progress ─────────────────────────────────────────────────────── */

/** 6px track with an optional ringed thumb sitting on the fill's leading edge. */
export function ProgressTrack({
  value,
  color,
  thumb = true,
  style,
}: {
  /** 0–1. */
  value: number;
  color: string;
  thumb?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, s } = useTheme();
  const pct = `${Math.max(0, Math.min(1, value)) * 100}%` as const;
  return (
    <View style={[styles.track, { backgroundColor: c.track }, style]}>
      <View style={[styles.fill, { width: pct, backgroundColor: color }]} />
      {thumb && (
        <View
          style={[
            styles.thumb,
            s.thumb,
            { left: pct, backgroundColor: color, borderColor: c.card },
          ]}
        />
      )}
    </View>
  );
}

/* ── Small bits ───────────────────────────────────────────────────── */

/** The uppercase, wide-tracked label above AI content. */
export function Kicker({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Txt weight={600} style={[styles.kicker, { color }]}>
      {children}
    </Txt>
  );
}

/** A pill-shaped status tag. */
export function Tag({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Txt weight={600} style={[styles.tagText, { color }]}>
        {label}
      </Txt>
    </View>
  );
}

/** A bulleted line inside a teal AI panel. */
export function Bullet({
  text,
  dot,
  color,
  size = 13.5,
}: {
  text: string;
  dot: string;
  color: string;
  size?: number;
}) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: dot }]} />
      <Txt style={{ fontSize: size, lineHeight: size * 1.55, color, flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  track: {
    height: 6,
    borderRadius: RADIUS.pill,
  },
  fill: { height: 6, borderRadius: RADIUS.pill },
  thumb: {
    position: 'absolute',
    top: -3,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
  kicker: {
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  tagText: { fontSize: 11.5 },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 7 },
});
