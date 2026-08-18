import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenState } from '../../components/feedback';
import { Screen, Section } from '../../components/layout';
import { Button, Txt } from '../../components/ui';
import { APP_VERSION } from '../../constants';
import { useApp } from '../../store';
import { RADIUS, SPACING, TYPE, useTheme } from '../../theme';
import { PreferenceRow, ToggleTrack } from './components/PreferenceRow';
import { ProfileHero } from './components/ProfileHero';

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
    <Screen gap={SPACING.lg}>
      <ProfileHero user={vm.user} connectedCount={connected} />

      <View style={styles.stats}>
        {vm.stats.map((stat) => (
          <View key={stat.label} style={[styles.stat, { backgroundColor: c.card }, s.soft]}>
            <Txt weight={700} style={[TYPE.h2, { color: statColor[stat.tone] }]}>
              {stat.value}
            </Txt>
            <Txt numberOfLines={2} style={[TYPE.captionSm, styles.statLabel, { color: c.ink3 }]}>
              {stat.label}
            </Txt>
          </View>
        ))}
      </View>

      <Section title="Connected sources">
        <View style={styles.sources}>
          {vm.sources.map((src) => (
            <View key={src.name} style={[styles.source, { backgroundColor: c.card }, s.soft]}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: src.connected ? c.vividTeal : c.check },
                ]}
              />
              <Txt
                weight={500}
                numberOfLines={1}
                style={[TYPE.bodySm, { color: src.connected ? c.ink : c.faint }]}
              >
                {src.name}
              </Txt>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Preferences">
        <View style={[styles.prefs, { backgroundColor: c.card }, s.card]}>
          <PreferenceRow icon="bell" tint={c.tealSoft} fg={c.teal} label="Notifications" />
          <PreferenceRow
            icon="moon"
            tint={c.periSoft}
            fg={c.peri}
            label="Dark mode"
            divider
            onPress={app.toggleDark}
            accessibilityRole="switch"
            accessibilityState={{ checked: dark }}
            trailing={<ToggleTrack on={dark} />}
          />
          <PreferenceRow
            icon="shield"
            tint={c.amberSoft}
            fg={c.amber}
            label="Privacy & security"
            divider
          />
          <PreferenceRow
            icon="sparkle"
            tint={c.roseSoft}
            fg={c.rose}
            label="Assistant preferences"
            divider
          />
        </View>
      </Section>

      <Button
        label="Log out"
        icon="logout"
        variant="danger"
        size="md"
        onPress={app.signOut}
      />

      <Txt style={[TYPE.captionSm, styles.version, { color: c.faint }]}>{APP_VERSION}</Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: SPACING.md },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.card,
  },
  statLabel: { textAlign: 'center' },

  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    flexShrink: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },

  prefs: { paddingHorizontal: SPACING.lg, borderRadius: RADIUS.cardLg },
  version: { textAlign: 'center' },
});
