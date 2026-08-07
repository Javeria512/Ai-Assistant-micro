import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Ports of the four CSS keyframe animations in the design doc. */

/* ── fadeup ───────────────────────────────────────────────────────────
   from { opacity: 0; translateY: 8px } to { opacity: 1; translateY: 0 }
   .26s ease both                                                       */

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
      duration: 260,
      delay,
      easing: Easing.out(Easing.quad),
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
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── dotb ─────────────────────────────────────────────────────────────
   0%,80%,100% { opacity:.25; translateY:0 }  40% { opacity:1; -3px }
   1.2s infinite, staggered .15s                                        */

function Dot({ color, delay }: { color: string; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(240),
      ]),
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [t, delay]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
        ],
      }}
    />
  );
}

/** The assistant's three-dot "thinking" bubble. */
export function TypingDots() {
  const { c, s } = useTheme();
  return (
    <View
      style={[
        styles.typing,
        { backgroundColor: c.card },
        s.soft,
      ]}
    >
      {[0, 150, 300].map((d) => (
        <Dot key={d} color={c.vividTeal} delay={d} />
      ))}
    </View>
  );
}

/* ── ring ─────────────────────────────────────────────────────────────
   An expanding, fading halo. CSS grew a box-shadow spread to 12px; here a
   sibling circle scales past the button and fades out behind it.        */

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
        duration: 2800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        // 0 → 70%: grow to full spread and fade out. 70 → 100%: stay invisible.
        opacity: t.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [0.42, 0, 0],
        }),
        transform: [
          {
            scale: t.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, (size + spread * 2) / size, 1],
            }),
          },
        ],
      }}
    />
  );
}

/* ── sheetup ──────────────────────────────────────────────────────────
   from { translateY: 34px; opacity:.4 } to { translateY: 0; opacity:1 }
   Used by Sheet.tsx, which owns its own value so it can also animate out. */

export const SHEET_IN = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

const styles = StyleSheet.create({
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 6,
    alignSelf: 'flex-start',
  },
});
