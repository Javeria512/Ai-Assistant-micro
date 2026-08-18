import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS, useTheme } from '../../theme';

export type CardProps = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Use the quieter one-layer shadow. */
  soft?: boolean;
};

/** The standard white 20pt card with a wide, diffuse shadow. */
export function Card({ style, children, soft = false }: CardProps) {
  const { c, s } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.card, borderRadius: RADIUS.cardLg },
        soft ? s.soft : s.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
