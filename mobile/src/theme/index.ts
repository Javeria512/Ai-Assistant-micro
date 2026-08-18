/** The design system: colour, type, space, elevation, and the scales behind them. */

export { DARK, LIGHT, LOGIN_LOCATIONS, ON_ACCENT } from './palette';
export type { Palette, VividKey } from './palette';

export {
  BREAKPOINT,
  DEVICE,
  MAX_FONT_SCALE,
  clamp,
  fs,
  ms,
  s,
  sizeClassFor,
} from './responsive';
export type { SizeClass } from './responsive';

export { FONT, FONT_FOR_WEIGHT, TYPE } from './typography';
export type { TypeKey, Weight } from './typography';

export {
  AVATAR,
  HIT_SLOP,
  ICON_WELL,
  MIN_TOUCH,
  RADIUS,
  SPACING,
  TAB_BAR_HEIGHT,
  TAB_BAR_HEIGHT_LANDSCAPE,
} from './spacing';

export { shadows } from './shadows';
export type { Shadows } from './shadows';

export { ThemeProvider, useTheme } from './ThemeProvider';
export type { Theme } from './ThemeProvider';
