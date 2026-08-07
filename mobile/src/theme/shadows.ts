import type { BoxShadowValue, ViewStyle } from 'react-native';

/**
 * The design's shadows, ported as-authored.
 *
 * React Native 0.86 accepts a `boxShadow` array, so the two-layer CSS stacks
 * survive intact instead of collapsing to one approximated layer (the legacy
 * `shadowColor`/`shadowRadius` props take only a single shadow, and are
 * deprecated besides).
 *
 * Shadows read as grime on dark surfaces, so `dark` trades the wide neutral
 * spreads for tighter black ones and lets surface colour carry elevation.
 */

type Shadow = Pick<ViewStyle, 'boxShadow'>;

const box = (...layers: BoxShadowValue[]): Shadow => ({ boxShadow: layers });

const N = (a: number) => `rgba(28,40,64,${a})`;
const K = (a: number) => `rgba(0,0,0,${a})`;

export const shadows = (dark: boolean) => ({
  /** 0 1px 3px rgba(28,40,64,.05) — day chips, stat tiles, quiet cards. */
  soft: dark
    ? box({ offsetX: 0, offsetY: 1, blurRadius: 4, color: K(0.3) })
    : box({ offsetX: 0, offsetY: 1, blurRadius: 3, color: N(0.05) }),

  /** 0 1px 2px rgba(28,40,64,.04), 0 8px 20px rgba(28,40,64,.06) */
  card: dark
    ? box(
        { offsetX: 0, offsetY: 1, blurRadius: 2, color: K(0.24) },
        { offsetX: 0, offsetY: 6, blurRadius: 16, color: K(0.3) },
      )
    : box(
        { offsetX: 0, offsetY: 1, blurRadius: 2, color: N(0.04) },
        { offsetX: 0, offsetY: 8, blurRadius: 20, color: N(0.06) },
      ),

  /** 0 8px 18px rgba(<accent>,.22) — saturated tiles and event cards. */
  colored: (accent: string): Shadow =>
    dark
      ? box({ offsetX: 0, offsetY: 6, blurRadius: 16, color: K(0.34) })
      : box({ offsetX: 0, offsetY: 8, blurRadius: 18, color: withAlpha(accent, 0.24) }),

  /** 0 -2px 18px rgba(28,40,64,.07) — the tab bar lifting off the content. */
  tabBar: dark
    ? box({ offsetX: 0, offsetY: -2, blurRadius: 18, color: K(0.4) })
    : box({ offsetX: 0, offsetY: -2, blurRadius: 18, color: N(0.07) }),

  /** 0 -4px 30px rgba(24,30,34,.2) — bottom sheets. */
  sheet: dark
    ? box({ offsetX: 0, offsetY: -4, blurRadius: 30, color: K(0.5) })
    : box({ offsetX: 0, offsetY: -4, blurRadius: 30, color: 'rgba(24,30,34,0.2)' }),

  /** 0 8px 24px rgba(24,30,34,.3) — the undo toast. */
  toast: box({ offsetX: 0, offsetY: 8, blurRadius: 24, color: 'rgba(24,30,34,0.3)' }),

  /** 0 1px 3px rgba(28,40,64,.2) — under a progress thumb or switch knob. */
  thumb: box({ offsetX: 0, offsetY: 1, blurRadius: 3, color: N(0.2) }),
});

/**
 * Applies an alpha to a `#rrggbb` accent so a tile's shadow is tinted with its
 * own colour, the way the design specifies per-tile shadow colours.
 */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return N(alpha);
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export type Shadows = ReturnType<typeof shadows>;
