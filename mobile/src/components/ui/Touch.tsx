import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export type TouchProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Opacity while held. */
  dim?: number;
  children?: React.ReactNode;
};

/**
 * The app's pressable.
 *
 * The design expressed affordance with hover (brightness / lift). Touch has no
 * hover, so the same intent becomes a press-down dim. Wrapping `Pressable` also
 * keeps the `style`-as-function signature out of every call site.
 */
export function Touch({ style, dim = 0.72, children, ...rest }: TouchProps) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && !rest.disabled && { opacity: dim }]}
    >
      {children}
    </Pressable>
  );
}
