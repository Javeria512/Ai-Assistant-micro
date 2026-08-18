/**
 * Live layout metrics — everything that must re-flow when the window changes.
 *
 * The static scales in `theme/` key off the device's *shorter* edge so type and
 * spacing hold still through a rotation. This hook is the other half: it reads
 * the current window on every change, so the things that genuinely should move
 * — column counts, page gutters, how tall a sheet may grow, whether the content
 * column gets capped and centred — move.
 *
 * Split out from `useTheme()` on purpose: rotating the device re-renders only
 * the components that asked for layout, not every component that asked for a
 * colour.
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  BREAKPOINT,
  DEVICE,
  SPACING,
  TAB_BAR_HEIGHT,
  TAB_BAR_HEIGHT_LANDSCAPE,
  clamp,
  ms,
  sizeClassFor,
  type SizeClass,
} from '../theme';

/**
 * Widest the reading column is allowed to get.
 *
 * Cards stretched across a 1024pt tablet look broken and read worse — line
 * lengths go past what the eye tracks comfortably. Past this width the column
 * stops growing and centres instead, which is also what makes landscape phones
 * look deliberate rather than stretched.
 */
const MAX_CONTENT_WIDTH = 640;

export type Responsive = {
  width: number;
  height: number;
  isLandscape: boolean;
  /** True for real tablets — a phone turned sideways is not one. */
  isTablet: boolean;
  /** Size class of the *current* width, so it flips on rotation. */
  sizeClass: SizeClass;
  /** Horizontal page gutter: tighter on small phones, roomier on tablets. */
  gutter: number;
  /** Width the content column actually occupies, after the cap. */
  contentWidth: number;
  /** Padding that centres a capped column inside a wide window. */
  sideInset: number;
  /** Columns for the Home glance grid: 2 upright, 4 when there is room. */
  glanceColumns: 2 | 4;
  /** Columns for the Profile stat row. */
  statColumns: number;
  /** Height of the tab bar, excluding safe-area inset. */
  tabBarHeight: number;
  /**
   * Caps a bottom sheet's share of the window. A phone in landscape is ~390pt
   * tall, where the portrait ratios leave a sheet too short to read, so short
   * windows are allowed a larger share.
   */
  sheetRatio: (portraitRatio: number) => number;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const sizeClass = sizeClassFor(width);

    // Small phones cannot afford an 18pt gutter on both sides; tablets look
    // mean with one. Both are derived from the same scale rather than guessed.
    const gutter =
      sizeClass === 'compact'
        ? SPACING.md
        : sizeClass === 'expanded'
          ? SPACING.xxl
          : ms(18);

    const available = width - gutter * 2;
    const contentWidth = Math.min(available, MAX_CONTENT_WIDTH);
    const sideInset = Math.max(0, (available - contentWidth) / 2);

    return {
      width,
      height,
      isLandscape,
      isTablet: DEVICE.isTablet,
      sizeClass,
      gutter,
      contentWidth,
      sideInset,
      // Four 2×2 tiles become one row once the column is wide enough that each
      // still clears ~140pt — below that the labels wrap and it looks worse.
      glanceColumns: contentWidth >= BREAKPOINT.expanded ? 4 : 2,
      statColumns: 3,
      tabBarHeight: isLandscape ? TAB_BAR_HEIGHT_LANDSCAPE : TAB_BAR_HEIGHT,
      sheetRatio: (portraitRatio: number) =>
        clamp(isLandscape ? portraitRatio + 0.16 : portraitRatio, 0.4, 0.94),
    };
  }, [width, height]);
}
