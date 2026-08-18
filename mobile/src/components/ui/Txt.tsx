import React from 'react';
import { Text, type TextProps } from 'react-native';
import { FONT_FOR_WEIGHT, MAX_FONT_SCALE, type Weight } from '../../theme';

export type TxtProps = TextProps & {
  /** 400 regular · 500 medium · 600 semibold · 700 bold. */
  weight?: Weight;
};

/**
 * Every piece of text in the app. Never use React Native's `Text` directly.
 *
 * Two things this guarantees that a bare `<Text>` does not:
 *
 * 1. **The right Poppins face.** React Native will not synthesise weights for a
 *    custom font — asking for `fontWeight: '600'` on Poppins silently gives you
 *    regular — so weight has to select a family name instead.
 * 2. **A ceiling on system text scaling.** Users who set very large text still
 *    get larger type, but capped, so the fixed-height pills, rows and tab bar
 *    the design specifies do not overflow at 200%.
 */
export function Txt({ weight = 400, style, ...rest }: TxtProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[{ fontFamily: FONT_FOR_WEIGHT[weight] }, style]}
    />
  );
}
