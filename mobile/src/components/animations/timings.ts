/** Durations and curves shared by the design's four keyframe animations. */

import { Easing } from 'react-native';

/** `fadeup` — .26s ease both. */
export const FADE_UP = {
  duration: 260,
  easing: Easing.out(Easing.quad),
  /** Distance the element rises, in points. */
  offset: 8,
} as const;

/** `dotb` — 1.2s infinite, staggered .15s across three dots. */
export const TYPING_DOT = {
  duration: 480,
  hold: 240,
  stagger: 150,
  easing: Easing.inOut(Easing.quad),
} as const;

/** `ring` — the expanding halo behind the mic button. */
export const PULSE = {
  duration: 2800,
  easing: Easing.out(Easing.quad),
} as const;

/** `sheetup` — the bottom sheet's entrance. */
export const SHEET_IN = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
} as const;

/** How long the sheet takes to slide back out. */
export const SHEET_OUT = {
  duration: 180,
  easing: Easing.in(Easing.cubic),
} as const;
