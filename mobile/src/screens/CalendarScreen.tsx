import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { Icon } from '../components/Icon';
import { ScreenState } from '../components/ScreenState';
import { Avatar, AvatarStack, Touch, Txt } from '../components/primitives';

export function CalendarScreen() {
  return (
    <ScreenState>
      <CalendarBody />
    </ScreenState>
  );
}

function CalendarBody() {
  const { c, s } = useTheme();
  const app = useApp();
  const vm = app.vm!;
  const openEvent = (id: string) => app.openDetail(`meeting:${id}`);

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: c.bg }]}
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
      {/* ── date ───────────────────────────────────────────────────── */}
      <View>
        <Txt style={[styles.eyebrow, { color: c.ink3 }]}>Today</Txt>
        <Txt weight={700} style={[styles.date, { color: c.ink }]}>
          {vm.user.today}
        </Txt>
      </View>

      {/* ── week strip ─────────────────────────────────────────────── */}
      <View style={styles.week}>
        {vm.week.map((d) => (
          <View
            key={d.date}
            style={[
              styles.day,
              d.active
                ? [{ backgroundColor: c.tealFill }, s.colored(c.tealFill)]
                : [{ backgroundColor: c.card }, s.soft],
            ]}
          >
            <Txt
              weight={500}
              style={[styles.dayName, { color: d.active ? '#ffffff' : c.ink3 }]}
            >
              {d.day}
            </Txt>
            <Txt
              weight={d.active ? 700 : 600}
              style={[styles.dayNum, { color: d.active ? '#ffffff' : c.ink }]}
            >
              {d.date}
            </Txt>
          </View>
        ))}
      </View>

      {/* ── next up ────────────────────────────────────────────────── */}
      {vm.nextUp && (
        <View
          style={[styles.hero, { backgroundColor: c.tealFill }, s.colored(c.tealFill)]}
        >
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <Txt weight={700} style={styles.heroTitle}>
                {vm.nextUp.title}
              </Txt>
              <View style={styles.heroTime}>
                <Icon name="clock" size={15} color="#ffffff" strokeWidth={2} />
                <Txt weight={500} style={styles.heroTimeText}>
                  {vm.nextUp.time}
                </Txt>
              </View>
            </View>
            <Touch
              onPress={() => openEvent(vm.nextUp!.id)}
              style={styles.heroMore}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Event options"
            >
              <Icon name="dotsVertical" size={16} color="#ffffff" />
            </Touch>
          </View>

          <View style={styles.heroPoints}>
            {vm.nextUp.points.map((p) => (
              <View key={p} style={styles.heroPointRow}>
                <View style={styles.heroDot} />
                <Txt style={styles.heroPointText}>{p}</Txt>
              </View>
            ))}
          </View>

          <Touch
            onPress={() => openEvent(vm.nextUp!.id)}
            dim={0.85}
            style={styles.heroCta}
            accessibilityRole="button"
          >
            <Txt weight={600} style={[styles.heroCtaText, { color: c.teal }]}>
              {vm.nextUp.cta}
            </Txt>
          </Touch>
        </View>
      )}

      {/* ── agenda ─────────────────────────────────────────────────── */}
      <View style={styles.sectionHead}>
        <Txt weight={600} style={[styles.h2, { color: c.ink }]}>
          Today's schedule
        </Txt>
        <Txt weight={500} style={[styles.seeAll, { color: c.teal }]}>
          {vm.agenda.length} event{vm.agenda.length === 1 ? '' : 's'}
        </Txt>
      </View>

      {vm.agenda.length === 0 && (
        <View style={[styles.empty, { backgroundColor: c.card }, s.soft]}>
          <Txt weight={600} style={[styles.emptyTitle, { color: c.ink }]}>
            Nothing scheduled
          </Txt>
          <Txt style={[styles.emptyBody, { color: c.ink3 }]}>
            Your calendar is clear for today.
          </Txt>
        </View>
      )}

      <View>
        {vm.agenda.map((ev, i) => {
          const first = i === 0;
          const last = i === vm.agenda.length - 1;
          const fill =
            ev.tone === 'peri' ? c.periFill : ev.tone === 'amber' ? c.amberFill : c.limeFill;
          const fg = ev.tone === 'amber' ? c.onAmber : '#ffffff';

          return (
            <View key={ev.id} style={styles.agendaRow}>
              <Txt weight={500} style={[styles.railTime, { color: c.ink3 }]}>
                {ev.rail}
              </Txt>

              {/* Continuous teal rail: a filled node at each end, a ring in
                  the middle, and segments joining them across rows. */}
              <View style={styles.rail}>
                <View
                  style={[
                    styles.railLine,
                    { height: 20, backgroundColor: first ? 'transparent' : c.vividTeal },
                  ]}
                />
                {first || last ? (
                  <View style={[styles.railDot, { backgroundColor: c.vividTeal }]} />
                ) : (
                  <View
                    style={[
                      styles.railRing,
                      { borderColor: c.vividTeal, backgroundColor: c.bg },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.railLine,
                    styles.flex,
                    { backgroundColor: last ? 'transparent' : c.vividTeal },
                  ]}
                />
              </View>

              <View style={[styles.flex, !last && styles.agendaGap]}>
                <Touch
                  onPress={() => openEvent(ev.id)}
                  dim={0.85}
                  style={[styles.event, { backgroundColor: fill }, s.colored(fill)]}
                  accessibilityRole="button"
                  accessibilityLabel={`${ev.title}, ${ev.time}`}
                >
                  <Txt weight={600} style={[styles.eventTitle, { color: fg }]}>
                    {ev.title}
                  </Txt>
                  <Txt
                    weight={ev.tone === 'amber' ? 500 : 400}
                    style={[styles.eventSub, { color: fg }]}
                  >
                    {ev.subtitle}
                  </Txt>

                  <View style={styles.eventFoot}>
                    <View style={styles.eventTime}>
                      <Icon name="clock" size={14} color={fg} strokeWidth={2} />
                      <Txt weight={500} style={[styles.eventTimeText, { color: fg }]}>
                        {ev.time}
                      </Txt>
                    </View>

                    {ev.avatars && (
                      <AvatarStack overlap={9}>
                        {ev.avatars.map((a) => (
                          <Avatar
                            key={a.label}
                            label={a.label}
                            size={25}
                            bg={a.bg ?? 'rgba(255,255,255,0.28)'}
                            color={fg}
                            fontSize={9}
                            ring={fill}
                          />
                        ))}
                      </AvatarStack>
                    )}
                  </View>
                </Touch>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 20 },

  eyebrow: { fontSize: 13.5 },
  date: { fontSize: 24, letterSpacing: -0.6, marginTop: 2 },

  week: { flexDirection: 'row', gap: 9 },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 16,
  },
  dayName: { fontSize: 11.5 },
  dayNum: { fontSize: 19, letterSpacing: -0.38 },

  hero: { padding: 17, borderRadius: RADIUS.cardLg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroTitle: { fontSize: 18, letterSpacing: -0.27, color: '#ffffff' },
  heroTime: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  heroTimeText: { fontSize: 13.5, color: '#ffffff' },
  heroMore: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPoints: { gap: 7, marginTop: 13 },
  heroPointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  heroDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ffffff',
    marginTop: 7,
  },
  heroPointText: { flex: 1, fontSize: 13, lineHeight: 19.5, color: '#ffffff' },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    backgroundColor: '#ffffff',
  },
  heroCtaText: { fontSize: 13 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  h2: { fontSize: 16.5 },
  seeAll: { fontSize: 12.5 },

  agendaRow: { flexDirection: 'row', gap: 14 },
  railTime: { width: 58, fontSize: 11.5, paddingTop: 14 },
  rail: { width: 16, alignItems: 'center' },
  railLine: { width: 2, borderRadius: 1 },
  railDot: { width: 10, height: 10, borderRadius: 5 },
  railRing: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  agendaGap: { paddingBottom: 13 },

  event: { padding: 15, borderRadius: RADIUS.card },
  eventTitle: { fontSize: 15.5, letterSpacing: -0.155 },
  eventSub: { fontSize: 12.5, marginTop: 3 },
  eventFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  eventTime: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventTimeText: { fontSize: 12.5 },

  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: RADIUS.cardLg,
  },
  emptyTitle: { fontSize: 16.5 },
  emptyBody: { fontSize: 13, textAlign: 'center' },
});
