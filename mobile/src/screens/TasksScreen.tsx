import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { FilterRow } from '../components/FilterRow';
import { Icon } from '../components/Icon';
import { ScreenState } from '../components/ScreenState';
import {
  Avatar,
  AvatarStack,
  Kicker,
  ProgressTrack,
  Touch,
  Txt,
} from '../components/primitives';

export function TasksScreen() {
  return (
    <ScreenState>
      <TasksBody />
    </ScreenState>
  );
}

function TasksBody() {
  const { c, s } = useTheme();
  const app = useApp();
  const vm = app.vm!;
  const [filter, setFilter] = useState<string>('All');

  // Categories come from whichever To Do / Planner lists the user actually has.
  const filters = ['All', ...vm.taskCategories];
  const visible = vm.tasks.filter((t) => filter === 'All' || t.category === filter);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <FilterRow options={filters} value={filter} onChange={setFilter} />

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={app.loading}
            onRefresh={app.refresh}
            tintColor={c.vividTeal}
            colors={[c.vividTeal]}
          />
        }
      >
        {/* ── priority insight ───────────────────────────────────────── */}
        {vm.priorityInsight && (
          <View style={[styles.insight, { backgroundColor: c.card }, s.card]}>
            <View style={styles.insightHead}>
              <View style={[styles.insightMark, { backgroundColor: c.vividTeal }]}>
                <Icon name="sparkle" size={13} color="#ffffff" />
              </View>
              <Kicker color={c.teal}>Priority insight</Kicker>
            </View>
            <Txt style={[styles.insightText, { color: c.ink }]}>
              {vm.priorityInsight}
            </Txt>
          </View>
        )}

        {/* ── open tasks ─────────────────────────────────────────────── */}
        {visible.map((t) => {
          const done = !!app.done[t.id];
          return (
            <Touch
              key={t.id}
              onPress={() => app.toggleTask(t.id)}
              dim={0.7}
              style={[styles.card, { backgroundColor: c.card }, s.card]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={t.title}
            >
              <View style={styles.row}>
                {done ? (
                  <View style={[styles.checkOn, { backgroundColor: c.vividTeal }]}>
                    <Icon name="check" size={14} color="#ffffff" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={[styles.checkOff, { borderColor: c.check }]} />
                )}

                <View style={styles.flex}>
                  <Txt weight={600} style={[styles.title, { color: c.ink }]}>
                    {t.title}
                  </Txt>
                  <View style={styles.metaRow}>
                    <Icon name="clock" size={14} color={c.faint} />
                    <Txt style={[styles.meta, { color: c.faint }]}>{t.meta}</Txt>
                  </View>
                </View>

                <View style={styles.owners}>
                  <AvatarStack overlap={10}>
                    <Avatar
                      label={t.owner.initials}
                      size={28}
                      bg={c[t.owner.bg]}
                      fontSize={9.5}
                      ring={c.card}
                    />
                    <View style={[styles.addPerson, { backgroundColor: c.chip, borderColor: c.card }]}>
                      <Icon name="plus" size={13} color={c.ink3} />
                    </View>
                  </AvatarStack>
                </View>
              </View>

              <View style={styles.progressRow}>
                <Txt style={[styles.progressLabel, { color: c.ink3 }]}>Progress</Txt>
                <Txt weight={600} style={[styles.progressPct, { color: c.ink }]}>
                  {app.pct[t.id]}%
                </Txt>
              </View>
              <ProgressTrack
                value={app.pct[t.id] / 100}
                color={c[t.bar]}
                style={styles.track}
              />
            </Touch>
          );
        })}

        {/* The daily brief carries only pending work, so there is no completed
            list to show here — the empty state stands in for it. */}
        {visible.length === 0 && (
          <View style={[styles.empty, { backgroundColor: c.card }, s.soft]}>
            <View style={[styles.emptyMark, { backgroundColor: c.tealSoft }]}>
              <Icon name="check" size={27} color={c.teal} strokeWidth={2.3} />
            </View>
            <Txt weight={600} style={[styles.emptyTitle, { color: c.ink }]}>
              Nothing pending
            </Txt>
            <Txt style={[styles.emptyBody, { color: c.ink3 }]}>
              {filter === 'All'
                ? 'You have no open tasks right now.'
                : `Nothing open in ${filter}.`}
            </Txt>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24, gap: 14 },

  insight: { padding: 16, borderRadius: RADIUS.cardLg },
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  insightMark: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: { fontSize: 14, lineHeight: 22.4 },

  card: { padding: 17, borderRadius: RADIUS.cardLg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  checkOn: {
    width: 24,
    height: 24,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOff: {
    width: 24,
    height: 24,
    borderRadius: 9,
    borderWidth: 2,
    marginTop: 1,
  },

  title: { fontSize: 15.5, lineHeight: 21, letterSpacing: -0.155 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { flex: 1, fontSize: 12.5 },

  owners: { marginTop: 2 },
  addPerson: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  progressLabel: { fontSize: 12.5 },
  progressPct: { fontSize: 13 },
  track: { marginTop: 8 },

  empty: {
    alignItems: 'center',
    gap: 11,
    paddingVertical: 44,
    paddingHorizontal: 24,
    borderRadius: RADIUS.cardLg,
  },
  emptyMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16.5 },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
