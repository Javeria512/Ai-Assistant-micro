/**
 * The type scale.
 *
 * Before this file every screen wrote its own `fontSize: 13.5` and guessed at a
 * line height, which is why the same "card title" measured 15.5 in one place and
 * 16.5 in another. The design's sizes are all still here — they have just been
 * collected into a named scale, so a heading is a heading everywhere.
 *
 * Sizes run through `fs()`, so they track screen size and the OS text-size
 * setting (capped — see `responsive.ts`). Entries deliberately carry no
 * `fontFamily`: weight selects the Poppins face, via `<Text weight={…}>`.
 */

import type { TextStyle } from 'react-native';
import { fs } from './responsive';

/**
 * Poppins weights. React Native cannot synthesise weights for custom fonts, so
 * every weight is its own family name rather than a `fontWeight`.
 *
 * These are the faces' PostScript names, which is what natively linked fonts
 * resolve by: Android matches `assets/fonts/<name>.ttf` and iOS matches the
 * PostScript name recorded in the file. (Under Expo the key passed to
 * `useFonts` was the name instead, hence the old `Poppins_400Regular` form.)
 */
export const FONT = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semibold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
} as const;

export const FONT_FOR_WEIGHT = {
  400: FONT.regular,
  500: FONT.medium,
  600: FONT.semibold,
  700: FONT.bold,
} as const;

export type Weight = keyof typeof FONT_FOR_WEIGHT;

/** Display type tightens; body type does not. Both match the design's ratios. */
const heading = (size: number, ratio = 1.3): TextStyle => ({
  fontSize: fs(size),
  lineHeight: fs(size) * ratio,
  letterSpacing: fs(size) * -0.025,
});

const body = (size: number, ratio = 1.55): TextStyle => ({
  fontSize: fs(size),
  lineHeight: fs(size) * ratio,
});

export const TYPE = {
  /** 30 — the login headline, the only type this large. */
  display: heading(30, 1.15),
  /** 24 — the date that opens Home and Calendar. */
  h1: heading(24, 1.2),
  /** 21 — profile name, stat values. */
  h2: heading(21, 1.25),
  /** 19 — glance-tile titles, day numbers, detail-sheet titles. */
  h3: heading(19, 1.3),
  /** 18 — the calendar "next up" hero, reminder-sheet title. */
  h4: heading(18, 1.3),
  /** 17 — the app bar title. */
  h5: heading(17, 1.3),

  /** 16.5 — section headings ("Today at a glance") and empty-state titles. */
  title: { fontSize: fs(16.5), lineHeight: fs(16.5) * 1.3 } as TextStyle,
  /** 15.5 — card titles, the login CTA. */
  subtitle: {
    fontSize: fs(15.5),
    lineHeight: fs(15.5) * 1.35,
    letterSpacing: fs(15.5) * -0.01,
  } as TextStyle,

  /** 14.5 — the composer input, preference rows. */
  body: body(14.5, 1.45),
  /** 14 — sheet buttons, priority insight. */
  bodyLg: body(14, 1.6),
  /** 13.5 — the default running text: greetings, chat bubbles, answers. */
  bodyMd: body(13.5, 1.55),
  /** 13 — supporting copy, hero bullet points, empty-state bodies. */
  bodySm: body(13, 1.5),

  /** 12.5 — metadata rows, timestamps, chips. */
  caption: body(12.5, 1.35),
  /** 11.5 — tags, day names, version strings, legal copy. */
  captionSm: body(11.5, 1.4),
  /** 11 — provenance lines under AI answers. */
  micro: body(11, 1.35),
  /** 10 — tab-bar labels and the unread badge. */
  nano: body(10, 1.2),

  /** The uppercase, wide-tracked label above AI content. */
  kicker: {
    fontSize: fs(10.5),
    lineHeight: fs(10.5) * 1.3,
    letterSpacing: fs(10.5) * 0.08,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;

export type TypeKey = keyof typeof TYPE;
