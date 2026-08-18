import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, IconWell, Txt } from '../../components/ui';
import { LOGIN_PROMISES } from '../../constants';
import { useResponsive } from '../../hooks';
import { useApp } from '../../store';
import {
  LOGIN_LOCATIONS,
  ON_ACCENT,
  RADIUS,
  SPACING,
  TYPE,
  ms,
  useTheme,
} from '../../theme';

/**
 * The signed-out screen: a gradient hero over a card carrying the single
 * Microsoft CTA.
 *
 * Upright the two stack, card pinned to the bottom edge. In landscape they sit
 * side by side — stacked, the hero alone was taller than the window and pushed
 * the sign-in button off-screen.
 */
export function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLandscape, width } = useResponsive();
  const { signIn, signingIn, authError } = useApp();

  const side = isLandscape && width >= 640;

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
        contentContainerStyle={[
          styles.scroll,
          side ? styles.scrollSide : styles.scrollStacked,
        ]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            side && styles.heroSide,
            {
              paddingTop: insets.top + (isLandscape ? SPACING.xl : SPACING.xxxl),
              paddingLeft: SPACING.xxl + insets.left,
              paddingRight: SPACING.xxl + (side ? 0 : insets.right),
            },
          ]}
        >
          <IconWell
            icon="sparkle"
            size={ms(64)}
            bg="rgba(255,255,255,0.22)"
            fg={ON_ACCENT}
            ratio={0.5}
            style={styles.mark}
          />
          <Txt weight={500} style={[TYPE.subtitle, styles.eyebrow]}>
            Welcome back,
          </Txt>
          <Txt weight={700} style={[TYPE.display, styles.headline]}>
            Your day, already{'\n'}organised.
          </Txt>
          <Txt style={[TYPE.body, styles.sub]}>
            Meetings, tasks, email and chats — read once, ranked for you, every
            morning.
          </Txt>
        </View>

        <View
          style={[
            styles.card,
            side ? styles.cardSide : null,
            {
              backgroundColor: c.card,
              paddingBottom: SPACING.xxl + insets.bottom,
              paddingLeft: SPACING.xxl + (side ? 0 : insets.left),
              paddingRight: SPACING.xxl + insets.right,
            },
          ]}
        >
          <Button
            label={signingIn ? 'Opening Microsoft…' : 'Continue with Microsoft'}
            icon="grid"
            size="lg"
            busy={signingIn}
            onPress={signIn}
          />

          {!!authError && (
            <View style={[styles.error, { backgroundColor: c.roseSoft }]}>
              <Icon name="alertCircle" size={ms(16)} color={c.rose} />
              <Txt style={[TYPE.caption, styles.errorText, { color: c.rose }]}>
                {authError}
              </Txt>
            </View>
          )}

          <View style={styles.promises}>
            {LOGIN_PROMISES.map((line) => (
              <View key={line} style={styles.promiseRow}>
                <IconWell
                  icon="check"
                  size={ms(26)}
                  bg={c.tealSoft}
                  fg={c.teal}
                  ratio={0.54}
                />
                <Txt style={[TYPE.bodySm, styles.promiseText, { color: c.ink2 }]}>
                  {line}
                </Txt>
              </View>
            ))}
          </View>

          {/* The design links these to placeholder anchors; they need real
              destinations before shipping. */}
          <Txt style={[TYPE.captionSm, styles.terms, { color: c.faint }]}>
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
  scroll: { flexGrow: 1 },
  scrollStacked: { justifyContent: 'flex-end' },
  scrollSide: { flexDirection: 'row', alignItems: 'stretch' },

  hero: { paddingBottom: SPACING.xxl, gap: SPACING.xs },
  heroSide: { flex: 1, minWidth: 0, justifyContent: 'center' },
  mark: { marginBottom: SPACING.lg },
  eyebrow: { color: 'rgba(255,255,255,0.9)' },
  headline: { color: ON_ACCENT },
  sub: { marginTop: SPACING.sm, color: 'rgba(255,255,255,0.9)' },

  card: {
    paddingTop: SPACING.xxl,
    borderTopLeftRadius: RADIUS.loginCard,
    borderTopRightRadius: RADIUS.loginCard,
    gap: SPACING.lg,
  },
  cardSide: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    borderBottomLeftRadius: RADIUS.loginCard,
    borderTopRightRadius: 0,
  },

  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.chip,
  },
  errorText: { flex: 1, minWidth: 0 },

  promises: { gap: SPACING.md },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  promiseText: { flex: 1, minWidth: 0 },

  terms: { textAlign: 'center' },
});
