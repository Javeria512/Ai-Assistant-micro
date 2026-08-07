import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { Touch, Txt } from './primitives';

/** The horizontally scrolling pill filters above the Chats and Tasks lists. */
export function FilterRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { c } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Touch
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.pill,
              active && { backgroundColor: c.tealFill, paddingHorizontal: 20 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Txt
              weight={active ? 600 : 500}
              style={[styles.label, { color: active ? '#ffffff' : c.ink3 }]}
            >
              {opt}
            </Txt>
          </Touch>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { gap: 9, paddingHorizontal: 18, paddingTop: 2, paddingBottom: 12 },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
  },
  label: { fontSize: 13 },
});
