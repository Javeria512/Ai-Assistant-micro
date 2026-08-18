import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { RADIUS, SPACING, ms, useTheme } from '../../theme';
import { TYPING_DOT } from './timings';

const DOT = ms(6);

function Dot({ color, delay }: { color: string; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: TYPING_DOT.duration,
          easing: TYPING_DOT.easing,
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: TYPING_DOT.duration,
          easing: TYPING_DOT.easing,
          useNativeDriver: true,
        }),
        Animated.delay(TYPING_DOT.hold),
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
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
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
      style={[styles.bubble, { backgroundColor: c.card }, s.soft]}
      accessibilityRole="progressbar"
      accessibilityLabel="Assistant is thinking"
    >
      {[0, 1, 2].map((i) => (
        <Dot key={i} color={c.vividTeal} delay={i * TYPING_DOT.stagger} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xxs,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderTopLeftRadius: RADIUS.cardLg,
    borderTopRightRadius: RADIUS.cardLg,
    borderBottomRightRadius: RADIUS.cardLg,
    borderBottomLeftRadius: SPACING.xs,
  },
});
