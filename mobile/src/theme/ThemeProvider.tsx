import React, { createContext, useContext, useMemo } from 'react';
import { DARK, LIGHT, Palette } from './tokens';
import { Shadows, shadows as makeShadows } from './shadows';

export type Theme = {
  dark: boolean;
  c: Palette;
  s: Shadows;
};

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
