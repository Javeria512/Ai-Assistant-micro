import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SPACING, TYPE, ms, useTheme } from '../../theme';
import { Txt } from './Txt';

const DOT = ms(5);

/** A bulleted line inside an AI explainer panel. */
export function Bullet({
  text,
  dot,
  color,
  style,
}: {
  text: string;
  dot: string;
  color: string;
  style?: (typeof TYPE)[keyof typeof TYPE];
}) {
  const type = style ?? TYPE.bodyMd;
  return (
    <View style={styles.row}>
      {/* Nudged down to sit on the first line's optical centre. */}
      <View
        style={[
          styles.dot,
          { backgroundColor: dot, marginTop: (Number(type.lineHeight) - DOT) / 2 },
        ]}
      />
      <Txt style={[type, styles.text, { color }]}>{text}</Txt>
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  text: { flex: 1, minWidth: 0 },
});
