import React, { useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { SUGGESTIONS } from '../data/content';
import { Icon, IconName } from '../components/Icon';
import { FadeUp, PulseRing, TypingDots } from '../components/animations';
import { Card, Kicker, Touch, Txt } from '../components/primitives';
import { ScreenState } from '../components/ScreenState';
import type { TabName, TabParamList } from '../navigation/types';

export function HomeScreen() {
  return (
    <ScreenState>
      <HomeBody />
    </ScreenState>
  );
}

function HomeBody() {
  const { c, s } = useTheme();
  const app = useApp();
  const vm = app.vm!;
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const scroller = useRef<ScrollView>(null);

  const go = (screen: TabName) => navigation.navigate(screen);

  // Follow the conversation as it grows.
  useEffect(() => {
    if (app.chat.length === 0) return;
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [app.chat.length, app.typing]);

  const submit = () => {
    app.ask(app.input);
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scroller}
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
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
        {/* ── greeting ─────────────────────────────────────────────── */}
        <View>
          <Txt style={[styles.greeting, { color: c.ink3 }]}>
            {vm.user.greeting || `Welcome back, ${vm.user.firstName}`}
          </Txt>
          <Txt weight={700} style={[styles.date, { color: c.ink }]}>
            {vm.user.today}
          </Txt>
        </View>

        {/* ── today at a glance ────────────────────────────────────── */}
        <View style={styles.section}>
          <Txt weight={600} style={[styles.h2, { color: c.ink }]}>
            Today at a glance
          </Txt>
          <View style={styles.gridRow}>
            <GlanceTile
              icon="calendar"
              title="Meetings"
              detail={`${vm.glance.meetings} today`}
              bg={c.tealFill}
              onPress={() => go('Calendar')}
            />
            <GlanceTile
              icon="listCheck"
              title="Tasks"
              detail={`${app.tasksLeft} pending`}
              bg={c.periFill}
              onPress={() => go('Tasks')}
            />
          </View>
          <View style={styles.gridRow}>
            <GlanceTile
              icon="alertCircle"
              title="Urgent"
              detail={`${vm.glance.urgent} items`}
              bg={c.amberFill}
              fg={c.onAmber}
              tint="rgba(255,255,255,0.34)"
              detailWeight={500}
              onPress={() => go('Tasks')}
            />
            <GlanceTile
              icon="mail"
              title="Replies"
              detail={`${app.msgCount} waiting`}
              bg={c.roseFill}
              onPress={() => go('Chats')}
            />
          </View>
        </View>

        {/* ── ask your AI ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Txt weight={600} style={[styles.h2, { color: c.ink }]}>
            Ask your AI
          </Txt>

          <View style={[styles.composer, { backgroundColor: c.card }, s.card]}>
            <View style={styles.micWrap}>
              <PulseRing size={44} color={c.vividTeal} />
              <View style={[styles.mic, { backgroundColor: c.vividTeal }]}>
                <Icon name="mic" size={20} color="#ffffff" />
              </View>
            </View>
            <TextInput
              value={app.input}
              onChangeText={app.setInput}
              onSubmitEditing={submit}
              returnKeyType="send"
              placeholder="Ask anything about your day…"
              placeholderTextColor={c.faint}
              style={[styles.input, { color: c.ink }]}
              accessibilityLabel="Ask your assistant"
            />
            <Touch
              onPress={submit}
              style={[styles.send, { backgroundColor: c.tealSoft }]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Icon name="send" size={18} color={c.teal} />
            </Touch>
          </View>

          <View style={styles.chips}>
            {SUGGESTIONS.map((chip) => (
              <Touch
                key={chip}
                onPress={() => app.ask(chip)}
                style={[styles.chip, { backgroundColor: c.card }, s.soft]}
                accessibilityRole="button"
              >
                <Txt weight={500} style={[styles.chipText, { color: c.ink2 }]}>
                  {chip}
                </Txt>
              </Touch>
            ))}
          </View>

          {app.chat.map((m, i) =>
            m.role === 'user' ? (
              <FadeUp key={i} style={styles.userRow}>
                <View style={[styles.userBubble, { backgroundColor: c.periFill }]}>
                  <Txt style={styles.userText}>{m.text}</Txt>
                </View>
              </FadeUp>
            ) : (
              <FadeUp key={i}>
                <View style={[styles.aiCard, { backgroundColor: c.card }, s.card]}>
                  <View style={styles.aiHead}>
                    <View style={[styles.aiMark, { backgroundColor: c.vividTeal }]}>
                      <Icon name="sparkle" size={12} color="#ffffff" />
                    </View>
                    <Kicker color={c.teal}>Assistant</Kicker>
                  </View>
                  <Txt style={[styles.aiText, { color: c.ink }]}>{m.text}</Txt>
                  <View style={[styles.aiFoot, { borderTopColor: c.line }]}>
                    <Icon name="doc" size={12} color={c.faint} />
                    <Txt style={[styles.aiSource, { color: c.faint }]}>{m.source}</Txt>
                  </View>
                </View>
              </FadeUp>
            ),
          )}

          {app.typing && <TypingDots />}
        </View>

        {/* ── short summary ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Txt weight={600} style={[styles.h2, { color: c.ink }]}>
            Short summary
          </Txt>
          <Card style={styles.summaryCard}>
            {vm.summaryRows.length === 0 && (
              <Txt style={[styles.summaryEmpty, { color: c.ink3 }]}>
                Nothing is competing for your attention right now.
              </Txt>
            )}
            {vm.summaryRows.map((row, i) => (
              <Touch
                key={i}
                onPress={() => go(row.go)}
                dim={0.6}
                style={[
                  styles.summaryRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.summaryDot, { backgroundColor: c[row.dot] }]} />
                <Txt style={[styles.summaryText, { color: c.ink }]}>
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
                <Icon name="chevronRight" size={16} color={c.faint} />
              </Touch>
            ))}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One of the four saturated shortcut tiles in the 2×2 glance grid. */
function GlanceTile({
  icon,
  title,
  detail,
  bg,
  fg = '#ffffff',
  tint = 'rgba(255,255,255,0.22)',
  detailWeight = 400,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  bg: string;
  fg?: string;
  tint?: string;
  detailWeight?: 400 | 500;
  onPress: () => void;
}) {
  const { s } = useTheme();
  return (
    <Touch
      onPress={onPress}
      dim={0.85}
      style={[styles.tile, { backgroundColor: bg }, s.colored(bg)]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
    >
      <View style={[styles.tileIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={19} color={fg} />
      </View>
      <Txt weight={700} style={[styles.tileTitle, { color: fg }]}>
        {title}
      </Txt>
      <View style={styles.tileFoot}>
        <Txt weight={detailWeight} style={[styles.tileDetail, { color: fg }]}>
          {detail}
        </Txt>
        <Icon name="arrowRight" size={19} color={fg} />
      </View>
    </Touch>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 22 },

  greeting: { fontSize: 13.5 },
  date: { fontSize: 24, letterSpacing: -0.6, marginTop: 2 },

  section: { gap: 13 },
  h2: { fontSize: 16.5 },

  gridRow: { flexDirection: 'row', gap: 13 },
  tile: { flex: 1, padding: 15, borderRadius: RADIUS.card },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  tileTitle: { fontSize: 19, letterSpacing: -0.19 },
  tileFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  tileDetail: { fontSize: 13 },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 9,
    borderRadius: RADIUS.pill,
  },
  micWrap: { alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14.5,
    padding: 0,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.pill },
  chipText: { fontSize: 12.5 },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 20,
  },
  userText: { fontSize: 13.5, lineHeight: 20.9, color: '#ffffff' },

  aiCard: {
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 6,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  aiMark: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: { fontSize: 13.5, lineHeight: 21.6 },
  aiFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  aiSource: { fontSize: 11, flex: 1 },

  summaryCard: { paddingHorizontal: 16, paddingVertical: 4 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
  },
  summaryDot: { width: 9, height: 9, borderRadius: 4.5 },
  summaryText: { flex: 1, fontSize: 13.5, lineHeight: 20.25 },
  summaryEmpty: { fontSize: 13.5, lineHeight: 20.25, paddingVertical: 15 },
});
