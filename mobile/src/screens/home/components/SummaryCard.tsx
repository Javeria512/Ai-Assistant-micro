import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Icon, Touch, Txt } from '../../../components/ui';
import type { SummaryRow, SummaryTarget } from '../../../models/view';
import { SPACING, TYPE, ms, useTheme } from '../../../theme';

const DOT = ms(9);

/** The ranked "short summary" list, each row deep-linking to its tab. */
export function SummaryCard({
  rows,
  onGo,
}: {
  rows: SummaryRow[];
  onGo: (target: SummaryTarget) => void;
}) {
  const { c } = useTheme();

  return (
    <Card style={styles.card}>
      {rows.length === 0 && (
        <Txt style={[TYPE.bodyMd, styles.empty, { color: c.ink3 }]}>
          Nothing is competing for your attention right now.
        </Txt>
      )}

      {rows.map((row, i) => (
        <Touch
          key={i}
          onPress={() => onGo(row.go)}
          dim={0.6}
          style={[
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
          ]}
          accessibilityRole="button"
          accessibilityLabel={row.parts.map((p) => p.text).join('')}
        >
          <View style={[styles.dot, { backgroundColor: c[row.dot] }]} />
          <Txt style={[TYPE.bodyMd, styles.text, { color: c.ink }]}>
            {row.parts.map((p, j) =>
              p.strong ? (
                <Txt key={j} weight={600}>
                  {p.text}
                </Txt>
              ) : (
                p.text
              ),
            )}
          </Txt>
          <Icon name="chevronRight" size={ms(16)} color={c.faint} />
        </Touch>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  text: { flex: 1, minWidth: 0 },
  empty: { paddingVertical: SPACING.lg },
});
