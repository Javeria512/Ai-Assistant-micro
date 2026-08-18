import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TOUCH, ON_ACCENT, RADIUS, SPACING, TYPE, ms, useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';
import { Touch } from './Touch';
import { Txt } from './Txt';

/**
 * Every pill button in the design, which previously existed as six near-copies
 * of the same 44/46/48/52/56pt-tall rounded rectangle scattered across the
 * screens. Height is the only thing that actually varied, so it became `size`.
 */
export type ButtonVariant =
  /** Filled teal — the affirmative action. */
  | 'primary'
  /** Neutral chip fill — the way out. */
  | 'secondary'
  /** Rose wash — sign out. */
  | 'danger'
  /** White on a saturated card, e.g. the calendar hero's CTA. */
  | 'onAccent';

export type ButtonSize = 'sm' | 'md' | 'lg';

const HEIGHT: Record<ButtonSize, number> = {
  sm: MIN_TOUCH,
  md: ms(48),
  lg: ms(56),
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Swaps the icon for a spinner and blocks presses. */
  busy?: boolean;
  disabled?: boolean;
  /** Grow to fill a flex row; a number sets the flex weight. */
  grow?: boolean | number;
  /** Hug the content instead of stretching — the hero CTA. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'sm',
  icon,
  busy = false,
  disabled = false,
  grow,
  inline = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { c, s } = useTheme();

  const skin: Record<ButtonVariant, { bg: string; fg: string; lift: boolean }> = {
    primary: { bg: c.tealFill, fg: ON_ACCENT, lift: true },
    secondary: { bg: c.chip, fg: c.ink2, lift: false },
    danger: { bg: c.roseSoft, fg: c.rose, lift: false },
    onAccent: { bg: c.card, fg: c.teal, lift: false },
  };
  const { bg, fg, lift } = skin[variant];
  const blocked = disabled || busy;

  return (
    <Touch
      onPress={onPress}
      disabled={blocked}
      dim={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy }}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          minHeight: HEIGHT[size],
          paddingHorizontal: inline ? SPACING.lg : SPACING.md,
        },
        lift && s.colored(bg),
        inline ? styles.inline : null,
        grow ? { flex: typeof grow === 'number' ? grow : 1 } : null,
        busy && styles.busy,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <Icon name={icon} size={ms(19)} color={fg} />
      ) : null}
      <Txt weight={600} numberOfLines={1} style={[TYPE.subtitle, { color: fg }]}>
        {label}
      </Txt>
    </Touch>
  );
}

/** A square icon-only button — the snooze clock on a message card. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  bg,
  fg,
  size = MIN_TOUCH,
  round = true,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  bg?: string;
  fg?: string;
  size?: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : RADIUS.tile,
          backgroundColor: bg ?? c.chip,
        },
        style,
      ]}
    >
      <Icon name={icon} size={size * 0.4} color={fg ?? c.ink2} />
    </Touch>
  );
}

/** Wraps a row of buttons so they share a gap and wrap rather than overflow. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  inline: { alignSelf: 'flex-start' },
  busy: { opacity: 0.75 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
