import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { LOGIN_LOCATIONS, RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { Icon } from '../components/Icon';
import { Touch, Txt } from '../components/primitives';

const PROMISES = [
  'Outlook, Teams, Calendar, To Do and OneDrive',
  'Read-only. Nothing leaves your tenant.',
];

export function LoginScreen() {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signingIn, authError } = useApp();

  return (
    // The tokens are readonly tuples; react-native-linear-gradient wants
    // mutable arrays, hence the copies.
    <LinearGradient
      colors={[...c.login]}
      locations={[...LOGIN_LOCATIONS]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.fill}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 34 }]}>
          <View style={styles.mark}>
            <Icon name="sparkle" size={32} color="#ffffff" />
          </View>
          <Txt weight={500} style={styles.eyebrow}>
            Welcome back,
          </Txt>
          <Txt weight={700} style={styles.headline}>
            Your day, already{'\n'}organised.
          </Txt>
          <Txt style={styles.sub}>
            Meetings, tasks, email and chats — read once, ranked for you, every
            morning.
          </Txt>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.card, paddingBottom: 30 + insets.bottom },
          ]}
        >
          <Touch
            onPress={signIn}
            disabled={signingIn}
            dim={0.88}
            style={[
              styles.cta,
              { backgroundColor: c.tealFill },
              s.colored(c.tealFill),
              signingIn && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: signingIn, busy: signingIn }}
          >
            {signingIn ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Icon name="grid" size={19} color="#ffffff" />
            )}
            <Txt weight={600} style={styles.ctaText}>
              {signingIn ? 'Opening Microsoft…' : 'Continue with Microsoft'}
            </Txt>
          </Touch>

          {authError && (
            <View style={[styles.error, { backgroundColor: c.roseSoft }]}>
              <Icon name="alertCircle" size={16} color={c.rose} />
              <Txt style={[styles.errorText, { color: c.rose }]}>{authError}</Txt>
            </View>
          )}

          <View style={styles.promises}>
            {PROMISES.map((line) => (
              <View key={line} style={styles.promiseRow}>
                <View style={[styles.tick, { backgroundColor: c.tealSoft }]}>
                  <Icon name="check" size={14} color={c.teal} />
                </View>
                <Txt style={[styles.promiseText, { color: c.ink2 }]}>{line}</Txt>
              </View>
            ))}
          </View>

          {/* The design links these to placeholder anchors; they need real
              destinations before shipping. */}
          <Txt style={[styles.terms, { color: c.faint }]}>
            By continuing you accept the{' '}
            <Txt style={{ color: c.teal }}>Terms</Txt> and{' '}
            <Txt style={{ color: c.teal }}>Privacy Policy</Txt>.
          </Txt>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },

  hero: { paddingHorizontal: 24, paddingBottom: 26, gap: 6 },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  eyebrow: { fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  headline: {
    fontSize: 30,
    lineHeight: 34.5,
    letterSpacing: -0.75,
    color: '#ffffff',
  },
  sub: {
    fontSize: 14,
    lineHeight: 22.4,
    marginTop: 8,
    color: 'rgba(255,255,255,0.9)',
  },

  card: {
    paddingHorizontal: 24,
    paddingTop: 26,
    borderTopLeftRadius: RADIUS.loginCard,
    borderTopRightRadius: RADIUS.loginCard,
    gap: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    height: 56,
    borderRadius: RADIUS.pill,
  },
  ctaText: { fontSize: 15.5, color: '#ffffff' },

  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: RADIUS.chip,
  },
  errorText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  promises: { gap: 11 },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promiseText: { flex: 1, fontSize: 13 },

  terms: { fontSize: 11.5, textAlign: 'center', lineHeight: 18 },
});
