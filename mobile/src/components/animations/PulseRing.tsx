import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { PULSE } from './timings';

/**
 * An expanding, fading halo behind the mic button.
 *
 * CSS grew a `box-shadow` spread to 12px; here a sibling circle scales past the
 * button and fades out behind it, which the native driver can run off the JS
 * thread.
 */
export function PulseRing({
  size,
  color,
  spread = 12,
}: {
  /** Diameter of the element being haloed. */
  size: number;
  color: string;
  spread?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: PULSE.duration,
        easing: PULSE.easing,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          // 0 → 70%: grow to full spread and fade out. 70 → 100%: stay invisible.
          opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.42, 0, 0] }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, (size + spread * 2) / size, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
});
