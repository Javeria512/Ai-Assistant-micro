import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { APP_VERSION } from '../data/content';
import { Icon, IconName } from '../components/Icon';
import { ScreenState } from '../components/ScreenState';
import { Touch, Txt } from '../components/primitives';

export function ProfileScreen() {
  return (
    <ScreenState>
      <ProfileBody />
    </ScreenState>
  );
}

function ProfileBody() {
  const { c, s, dark } = useTheme();
  const app = useApp();
  const vm = app.vm!;

  const statColor = { teal: c.teal, peri: c.peri, amber: c.amber };
  const connected = vm.sources.filter((x) => x.connected).length;

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: c.bg }]}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── identity ───────────────────────────────────────────────── */}
      <View style={[styles.hero, { backgroundColor: c.tealFill }, s.colored(c.tealFill)]}>
        <View style={styles.heroAvatar}>
          <Txt weight={600} style={styles.heroInitials}>
            {vm.user.initials}
          </Txt>
        </View>
        <View style={styles.heroText}>
          <Txt weight={700} style={styles.heroName}>
            {vm.user.name}
          </Txt>
          <Txt style={styles.heroRole}>{vm.user.role}</Txt>
        </View>
        <View style={styles.heroTags}>
          <View style={styles.heroTag}>
            <Txt weight={500} style={styles.heroTagText}>
              {connected} source{connected === 1 ? '' : 's'} synced
            </Txt>
          </View>
          <View style={[styles.heroTag, styles.heroTagSolid]}>
            <Txt weight={600} style={[styles.heroTagText, { color: c.teal }]}>
              Microsoft 365
            </Txt>
          </View>
        </View>
      </View>

      {/* ── stats ──────────────────────────────────────────────────── */}
      <View style={styles.stats}>
        {vm.stats.map((stat) => (
          <View
            key={stat.label}
            style={[styles.stat, { backgroundColor: c.card }, s.soft]}
          >
            <Txt weight={700} style={[styles.statValue, { color: statColor[stat.tone] }]}>
              {stat.value}
            </Txt>
            <Txt style={[styles.statLabel, { color: c.ink3 }]}>{stat.label}</Txt>
          </View>
        ))}
      </View>

      {/* ── connected sources ──────────────────────────────────────── */}
      <View>
        <Txt weight={600} style={[styles.h2, { color: c.ink }]}>
          Connected sources
        </Txt>
        <View style={styles.sources}>
          {vm.sources.map((src) => (
            <View
              key={src.name}
              style={[styles.source, { backgroundColor: c.card }, s.soft]}
            >
              <View
                style={[
                  styles.sourceDot,
                  { backgroundColor: src.connected ? c.vividTeal : c.check },
                ]}
              />
              <Txt
                weight={500}
                style={[
                  styles.sourceText,
                  { color: src.connected ? c.ink : c.faint },
                ]}
              >
                {src.name}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* ── preferences ────────────────────────────────────────────── */}
      <View>
        <Txt weight={600} style={[styles.h2, { color: c.ink }]}>
          Preferences
        </Txt>
        <View style={[styles.prefs, { backgroundColor: c.card }, s.card]}>
          <PrefRow icon="bell" tint={c.tealSoft} fg={c.teal} label="Notifications" />

          <PrefRow
            icon="moon"
            tint={c.periSoft}
            fg={c.peri}
            label="Dark mode"
            divider
            onPress={app.toggleDark}
            accessibilityRole="switch"
            accessibilityState={{ checked: dark }}
            trailing={
              <View style={[styles.switch, { backgroundColor: c.switchTrack }]}>
                <View style={[styles.knob, s.thumb, { left: dark ? 23 : 3 }]} />
              </View>
            }
          />

          <PrefRow
            icon="shield"
            tint={c.amberSoft}
            fg={c.amber}
            label="Privacy & security"
            divider
          />
          <PrefRow
            icon="sparkle"
            tint={c.roseSoft}
            fg={c.rose}
            label="Assistant preferences"
            divider
          />
        </View>
      </View>

      {/* ── sign out ───────────────────────────────────────────────── */}
      <Touch
        onPress={app.signOut}
        style={[styles.logout, { backgroundColor: c.roseSoft }]}
        accessibilityRole="button"
      >
        <Icon name="logout" size={18} color={c.rose} />
        <Txt weight={600} style={[styles.logoutText, { color: c.rose }]}>
          Log out
        </Txt>
      </Touch>

      <Txt style={[styles.version, { color: c.faint }]}>{APP_VERSION}</Txt>
    </ScrollView>
  );
}

/** One row in the preferences card: tinted icon, label, and a trailing control. */
function PrefRow({
  icon,
  tint,
  fg,
  label,
  divider,
  onPress,
  trailing,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  icon: IconName;
  tint: string;
  fg: string;
  label: string;
  divider?: boolean;
  onPress?: () => void;
  trailing?: React.ReactNode;
  accessibilityRole?: 'button' | 'switch';
  accessibilityState?: { checked?: boolean };
}) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      dim={0.65}
      style={[styles.pref, divider && { borderTopWidth: 1, borderTopColor: c.line }]}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
    >
      <View style={[styles.prefIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={18} color={fg} />
      </View>
      <Txt weight={500} style={[styles.prefLabel, { color: c.ink }]}>
        {label}
      </Txt>
      {trailing ?? <Icon name="chevronRight" size={17} color={c.faint} />}
    </Touch>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 18 },

  hero: {
    alignItems: 'center',
    gap: 13,
    paddingVertical: 26,
    paddingHorizontal: 18,
    borderRadius: RADIUS.hero,
  },
  heroAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitials: { fontSize: 27, color: '#ffffff' },
  heroText: { alignItems: 'center' },
  heroName: { fontSize: 21, letterSpacing: -0.42, color: '#ffffff' },
  heroRole: { fontSize: 13.5, marginTop: 3, color: '#ffffff' },
  heroTags: { flexDirection: 'row', gap: 9 },
  heroTag: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroTagSolid: { backgroundColor: '#ffffff' },
  heroTagText: { fontSize: 12, color: '#ffffff' },

  stats: { flexDirection: 'row', gap: 11 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 15,
    paddingHorizontal: 8,
    borderRadius: RADIUS.card,
  },
  statValue: { fontSize: 21, letterSpacing: -0.42 },
  statLabel: { fontSize: 11.5, textAlign: 'center' },

  h2: { fontSize: 16.5, marginHorizontal: 2, marginBottom: 11 },

  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: RADIUS.pill,
  },
  sourceDot: { width: 7, height: 7, borderRadius: 3.5 },
  sourceText: { fontSize: 13 },

  prefs: { paddingHorizontal: 17, borderRadius: RADIUS.cardLg },
  pref: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefLabel: { flex: 1, fontSize: 14.5 },

  switch: { width: 48, height: 28, borderRadius: 14 },
  knob: {
    position: 'absolute',
    top: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 52,
    borderRadius: RADIUS.pill,
  },
  logoutText: { fontSize: 14.5 },

  version: { fontSize: 11.5, textAlign: 'center' },
});
