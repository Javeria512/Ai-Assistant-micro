import React, { createContext, useContext, useMemo } from 'react';
import { DARK, LIGHT, type Palette } from './palette';
import { shadows as makeShadows, type Shadows } from './shadows';

export type Theme = {
  dark: boolean;
  /** Colours. Short because it appears in almost every style array. */
  c: Palette;
  /** Elevation. Same reasoning. */
  s: Shadows;
};

/**
 * Deliberately holds only what a *repaint* depends on. Anything that changes
 * with window size lives in `useResponsive()` instead, so rotating the device
 * does not re-render every themed component in the tree.
 */
const ThemeContext = createContext<Theme>({
  dark: false,
  c: LIGHT,
  s: makeShadows(false),
});

export function ThemeProvider({
  dark,
  children,
}: {
  dark: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo<Theme>(
    () => ({ dark, c: dark ? DARK : LIGHT, s: makeShadows(dark) }),
    [dark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
