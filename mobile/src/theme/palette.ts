/**
 * Colour tokens, ported 1:1 from the "AI Assistant Vivid" design doc.
 *
 * The source used CSS custom properties (`--v-*`) swapped between a LIGHT and a
 * DARK map. Those maps are the authoritative values — where an inline fallback
 * in the markup disagreed with the map (e.g. `--v-vivid-rose`), the map wins,
 * because the variable always resolved.
 */

export type Palette = {
  // surfaces
  bg: string;
  card: string;
  chrome: string;
  chip: string;
  track: string;
  line: string;
  check: string;
  // ink
  ink: string;
  ink2: string;
  ink3: string;
  faint: string;
  nav: string;
  // teal (primary)
  teal: string;
  tealFill: string;
  tealSoft: string;
  tealLine: string;
  vividTeal: string;
  // periwinkle
  peri: string;
  /** Surface fill for periwinkle tiles carrying white text. */
  periFill: string;
  periSoft: string;
  vividPeri: string;
  // amber
  amber: string;
  amberFill: string;
  onAmber: string;
  amberSoft: string;
  vividAmber: string;
  // rose
  rose: string;
  /** Surface fill for rose tiles carrying white text. */
  roseFill: string;
  roseSoft: string;
  vividRose: string;
  // lime
  lime: string;
  /** Surface fill for lime tiles carrying white text. */
  limeFill: string;
  vividLime: string;
  // login gradient
  login: readonly [string, string, string];
  // controls & chrome
  switchTrack: string;
  scrim: string;
  toastBg: string;
  toastAction: string;
  /** Backdrop behind the whole app (the design doc's canvas colour). */
  canvas: string;
};

/** Ink that always sits on a saturated fill, in either theme. */
export const ON_ACCENT = '#ffffff';

export const LIGHT: Palette = {
  bg: '#f7f8f8',
  card: '#ffffff',
  chrome: '#ffffff',
  chip: '#eef0f2',
  track: '#eef0f2',
  line: '#f0f1f3',
  check: '#d3d7dd',

  ink: '#2e3038',
  ink2: '#565a66',
  ink3: '#636873',
  faint: '#666b76',
  nav: '#6c7280',

  teal: '#0e6b5b',
  tealFill: '#14806d',
  tealSoft: '#e2f4f0',
  tealLine: '#c9e7e0',
  vividTeal: '#2fa68f',

  peri: '#4e56a8',
  periFill: '#4e56a8',
  periSoft: '#eceef8',
  vividPeri: '#7c83c4',

  amber: '#8f5409',
  amberFill: '#f5a33c',
  onAmber: '#3d2600',
  amberSoft: '#fdf0dc',
  vividAmber: '#e08f22',

  rose: '#c22765',
  roseFill: '#c22765',
  roseSoft: '#ffe6ef',
  vividRose: '#e2447b',

  lime: '#5f7c14',
  limeFill: '#5f7c14',
  vividLime: '#8aab2c',

  login: ['#4fc0a8', '#2fa68f', '#7c83c4'],

  switchTrack: '#dfe3e7',
  scrim: 'rgba(24,30,34,0.5)',
  toastBg: '#2e3038',
  toastAction: '#6fd8bd',
  canvas: '#e8eaec',
};

export const DARK: Palette = {
  bg: '#16181d',
  card: '#1f2229',
  chrome: '#1c1f25',
  chip: '#2b2f38',
  track: '#2b2f38',
  line: '#2a2e36',
  check: '#474d59',

  ink: '#f2f4f6',
  ink2: '#c6cad2',
  ink3: '#a8adb7',
  faint: '#9aa0ab',
  nav: '#7d838f',

  teal: '#5fd3b9',
  tealFill: '#1d7a68',
  tealSoft: '#123a34',
  tealLine: '#1d5b50',
  vividTeal: '#3fbfa4',

  peri: '#a3aae8',
  // The doc's dark `--v-peri` is a light tint meant for text. Tiles that fill
  // with it and print white on top fall to ~2:1, so filled surfaces get their
  // own dark value here — the same split teal already had (teal / tealFill).
  periFill: '#454c9c',
  periSoft: '#232744',
  vividPeri: '#8f96d6',

  amber: '#f2b263',
  amberFill: '#d98f2e',
  onAmber: '#2e1c00',
  amberSoft: '#3b2c14',
  vividAmber: '#e08f22',

  rose: '#f992b3',
  roseFill: '#ab2358',
  roseSoft: '#3f1526',
  vividRose: '#e2447b',

  lime: '#bcd96b',
  limeFill: '#55701a',
  vividLime: '#8aab2c',

  login: ['#1d6a5c', '#175248', '#3c4180'],

  switchTrack: '#2fa68f',
  scrim: 'rgba(24,30,34,0.6)',
  toastBg: '#2e3038',
  toastAction: '#6fd8bd',
  canvas: '#101215',
};

/** Gradient stop positions for the login backdrop (0% / 40% / 100%). */
export const LOGIN_LOCATIONS = [0, 0.4, 1] as const;

/** Palette keys that name a saturated accent, for props that pick one by name. */
export type VividKey = 'vividTeal' | 'vividPeri' | 'vividAmber' | 'vividRose';
