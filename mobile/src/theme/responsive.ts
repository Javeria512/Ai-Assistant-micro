/**
 * Device metrics and the scaling functions every other token is built from.
 *
 * The design was drawn once, at a 390pt-wide phone. Everything downstream is
 * expressed relative to that so a 320pt phone, a 430pt phone and a 768pt tablet
 * all get proportionate — not identical — spacing and type.
 *
 * ## Why the basis is the *shortest* screen edge
 *
 * Scaling off `width` would resize every glyph and gutter the moment the device
 * rotates, which is both jarring and expensive (every `StyleSheet.create` in the
 * app would have to become a dynamic style). `min(width, height)` does not
 * change on rotation, so the type and spacing scales can stay static and cheap.
 *
 * Layout that genuinely *must* re-flow on rotation — column counts, gutters,
 * content width, sheet height — reads live values from `useResponsive()`
 * instead. See `src/hooks/useResponsive.ts`.
 */

import { Dimensions, PixelRatio } from 'react-native';

/** Width of the artboard the design was drawn against. */
const BASE_WIDTH = 390;

/**
 * Width thresholds, in the same points the design uses.
 *
 * `compact`  — iPhone SE / small Androids (≤ 359)
 * `regular`  — the mainstream phone the design targets (360–599)
 * `expanded` — tablets, foldables, and phones held in landscape (≥ 600)
 */
export const BREAKPOINT = {
  regular: 360,
  expanded: 600,
} as const;

export type SizeClass = 'compact' | 'regular' | 'expanded';

export function sizeClassFor(width: number): SizeClass {
  if (width >= BREAKPOINT.expanded) return 'expanded';
  if (width >= BREAKPOINT.regular) return 'regular';
  return 'compact';
}

const window = Dimensions.get('window');

/**
 * Rotation-invariant device metrics, resolved once at module load.
 *
 * Only used for the static type and spacing scales. Anything that reacts to
 * rotation must use `useResponsive()`.
 */
export const DEVICE = {
  /** Shorter edge — the phone's "width" regardless of how it is held. */
  shortest: Math.min(window.width, window.height),
  longest: Math.max(window.width, window.height),
  /** Size class of the shorter edge, so a rotated phone is not called a tablet. */
  sizeClass: sizeClassFor(Math.min(window.width, window.height)),
  isTablet: Math.min(window.width, window.height) >= BREAKPOINT.expanded,
} as const;

/** Clamps `n` into `[min, max]`. */
export const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** Rounds to the nearest device pixel so borders and hairlines stay crisp. */
const snap = (n: number) => PixelRatio.roundToNearestPixel(n);

/**
 * Linear scale: `size` at 390pt wide, proportionally more or less elsewhere.
 * Use for things that should track the screen exactly — icon wells, avatars.
 */
export function s(size: number): number {
  return snap((DEVICE.shortest / BASE_WIDTH) * size);
}

/**
 * Moderate scale — the workhorse.
 *
 * Linear scaling overshoots badly at the extremes: a 24pt heading becomes 20pt
 * on an SE (cramped but survivable) and 47pt on a tablet (absurd). `ms` applies
 * only `factor` of the difference, so sizes drift toward the screen without
 * chasing it, and the result is clamped to ±30% of the design value.
 */
export function ms(size: number, factor = 0.5): number {
  const scaled = size + (s(size) - size) * factor;
  return snap(clamp(scaled, size * 0.85, size * 1.3));
}

/**
 * Ceiling on the OS text-size setting.
 *
 * React Native already multiplies every `<Text>` by the system font scale, so
 * this is *not* applied here — doing so would double-count it. It is passed to
 * `maxFontSizeMultiplier` on the shared `<Txt>` instead, which is the supported
 * way to say "respect the user's larger text, but not so much that fixed-height
 * rows and pill buttons overflow".
 */
export const MAX_FONT_SCALE = 1.3;

/**
 * Type scale. Drifts less than `ms` does, because a heading that grows as fast
 * as its container stops reading as a heading.
 */
export function fs(size: number): number {
  return ms(size, 0.35);
}
