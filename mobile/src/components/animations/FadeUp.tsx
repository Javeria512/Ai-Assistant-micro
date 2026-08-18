import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { FADE_UP } from './timings';

/**
 * The design's `fadeup` keyframe: content arrives from 8px below at zero
 * opacity. Used for chat bubbles and the undo toast.
 */
export function FadeUp({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: FADE_UP.duration,
      delay,
      easing: FADE_UP.easing,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            {
              translateY: t.interpolate({
                inputRange: [0, 1],
                outputRange: [FADE_UP.offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
