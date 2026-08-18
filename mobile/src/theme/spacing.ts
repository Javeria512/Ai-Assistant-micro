/**
 * Spacing, radii and the fixed sizes of recurring chrome.
 *
 * The design's gaps clustered around 8 / 12 / 14 / 18 / 22 with a lot of drift
 * (9, 11, 13, 15, 17 all appeared). They are snapped to a 4pt-derived scale
 * here, then run through `ms()` so the rhythm tightens on small phones and
 * opens up on tablets.
 */

import { ms, s } from './responsive';

export const SPACING = {
  /** 4 — icon-to-label, the tightest gap in the design. */
  xxs: ms(4),
  /** 6 — inside pills and metadata rows. */
  xs: ms(6),
  /** 8 — between sibling chips. */
  sm: ms(8),
  /** 12 — the default gap inside a card. */
  md: ms(12),
  /** 16 — card padding, gap between cards. */
  lg: ms(16),
  /** 20 — sheet padding, gap between sections' contents. */
  xl: ms(20),
  /** 24 — gap between major sections. */
  xxl: ms(24),
  /** 32 — the breathing room around an empty state. */
  xxxl: ms(32),
} as const;

/** Corner radii used across the design. */
export const RADIUS = {
  tile: ms(12),
  chip: ms(14),
  card: ms(18),
  cardLg: ms(20),
  hero: ms(24),
  sheet: ms(30),
  loginCard: ms(34),
  pill: 9999,
} as const;

/**
 * Minimum tappable size. Below this a control is hard to hit reliably, so
 * anything smaller in the design gets `hitSlop` rather than a smaller target.
 */
export const HIT_SLOP = 8;
export const MIN_TOUCH = 44;

/**
 * Height of the tab bar, excluding the bottom safe-area inset.
 *
 * The Toast renders outside the navigator, so it cannot ask React Navigation how
 * tall the bar is — it offsets by this instead. Keep both values in step with
 * `TabBar`'s own padding and `minHeight` if that component changes.
 */
export const TAB_BAR_HEIGHT = ms(74);

/** Same, for the shorter horizontal bar used in landscape. */
export const TAB_BAR_HEIGHT_LANDSCAPE = ms(56);

/** Sizes for the round avatars that recur at four scales. */
export const AVATAR = {
  xs: s(25),
  sm: s(28),
  md: s(38),
  lg: s(40),
  xl: s(84),
} as const;

/** Square icon wells (the tinted rounded squares behind a glyph). */
export const ICON_WELL = {
  sm: s(22),
  md: s(36),
  lg: s(38),
  xl: s(56),
} as const;
