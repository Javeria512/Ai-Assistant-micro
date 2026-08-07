import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { CHAT_FILTERS } from '../data/content';
import { FilterRow } from '../components/FilterRow';
import { Icon } from '../components/Icon';
import { ScreenState } from '../components/ScreenState';
import {
  Avatar,
  Kicker,
  ProgressTrack,
  Tag,
  Touch,
  Txt,
} from '../components/primitives';

type Filter = (typeof CHAT_FILTERS)[number];

export function ChatsScreen() {
  return (
    <ScreenState>
      <ChatsBody />
    </ScreenState>
  );
}

function ChatsBody() {
  const { c, s } = useTheme();
  const app = useApp();
  const [filter, setFilter] = useState<Filter>('All');

  const visible = app.vm!.messages.filter((m) => {
    if (app.gone[m.id]) return false;
    if (filter === 'Urgent') return m.urgent;
    if (filter === 'Email') return m.channel === 'Outlook';
    if (filter === 'Teams') return m.channel === 'Teams';
    return true;
  });

  const tagColors = (tone: 'rose' | 'amber' | 'neutral') =>
    tone === 'rose'
      ? { bg: c.roseSoft, fg: c.rose }
      : tone === 'amber'
        ? { bg: c.amberSoft, fg: c.amber }
        : { bg: c.chip, fg: c.ink2 };

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <FilterRow options={CHAT_FILTERS} value={filter} onChange={setFilter} />

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
        {visible.map((m) => {
          const tag = tagColors(m.priority.tone);
          return (
            <View key={m.id} style={[styles.card, { backgroundColor: c.card }, s.card]}>
              <Touch
                onPress={() => app.openDetail(m.id)}
                dim={0.65}
                style={styles.head}
                accessibilityRole="button"
                accessibilityLabel={`Open ${m.title}`}
              >
                <View style={styles.flex}>
                  <Txt weight={600} style={[styles.title, { color: c.ink }]}>
                    {m.title}
                  </Txt>
                  <View style={styles.metaRow}>
                    <Icon name="clock" size={14} color={c.faint} />
                    <Txt style={[styles.meta, { color: c.faint }]}>{m.meta}</Txt>
                  </View>
                </View>
                <Avatar
                  label={m.initials}
                  size={38}
                  bg={c[m.avatar]}
                  fontSize={12.5}
                />
              </Touch>

              <View style={styles.statusRow}>
                <Tag label={m.priority.label} bg={tag.bg} color={tag.fg} />
                <Txt weight={600} style={[styles.deadline, { color: c.ink3 }]}>
                  {m.deadline}
                </Txt>
              </View>

              <ProgressTrack
                value={m.progress}
                color={c[m.bar]}
                style={styles.track}
              />

              {m.suggestion && (
                <View style={[styles.suggestion, { backgroundColor: c.tealSoft }]}>
                  <Kicker color={c.teal}>AI suggestion</Kicker>
                  <Txt style={[styles.suggestionText, { color: c.ink }]}>
                    {m.suggestion}
                  </Txt>
                </View>
              )}

              <View style={styles.actions}>
                <Touch
                  onPress={() => app.reply(m.id)}
                  dim={0.85}
                  style={[styles.primary, { backgroundColor: c.tealFill }]}
                  accessibilityRole="button"
                >
                  <Txt weight={600} style={styles.primaryText}>
                    Reply with AI
                  </Txt>
                </Touch>
                <Touch
                  onPress={() => app.openDetail(m.id)}
                  style={[styles.secondary, { backgroundColor: c.chip }]}
                  accessibilityRole="button"
                >
                  <Txt weight={600} style={[styles.secondaryText, { color: c.ink2 }]}>
                    Open
                  </Txt>
                </Touch>
                <Touch
                  onPress={() => app.snooze(m.id)}
                  style={[styles.snooze, { backgroundColor: c.chip }]}
                  accessibilityRole="button"
                  accessibilityLabel="Snooze for an hour"
                >
                  <Icon name="clock" size={17} color={c.ink2} />
                </Touch>
              </View>
            </View>
          );
        })}

        {visible.length === 0 && (
          <View style={[styles.empty, { backgroundColor: c.card }, s.soft]}>
            <View style={[styles.emptyMark, { backgroundColor: c.tealSoft }]}>
              <Icon name="check" size={27} color={c.teal} strokeWidth={2.3} />
            </View>
            <Txt weight={600} style={[styles.emptyTitle, { color: c.ink }]}>
              All clear
            </Txt>
            <Txt style={[styles.emptyBody, { color: c.ink3 }]}>
              {app.msgCount === 0
                ? "Nothing is waiting on you. I'll surface the next thing that matters."
                : `Nothing in ${filter.toLowerCase()} right now.`}
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

  card: { padding: 17, borderRadius: RADIUS.cardLg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 15.5, lineHeight: 21, letterSpacing: -0.155 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { flex: 1, fontSize: 12.5 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  deadline: { fontSize: 12.5 },
  track: { marginTop: 9 },

  suggestion: {
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: RADIUS.chip,
  },
  suggestionText: { fontSize: 13, lineHeight: 20.8, marginTop: 6 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: {
    flex: 1.3,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 13.5, color: '#ffffff' },
  secondary: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 13.5 },
  snooze: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
