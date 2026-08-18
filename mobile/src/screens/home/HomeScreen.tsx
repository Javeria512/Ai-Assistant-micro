import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Screen, Section } from '../../components/layout';
import { ScreenState } from '../../components/feedback';
import { Txt } from '../../components/ui';
import { useAutoScroll } from '../../hooks';
import type { TabName, TabParamList } from '../../navigation/types';
import { useApp } from '../../store';
import { SPACING, TYPE, useTheme } from '../../theme';
import { ChatThread } from './components/ChatThread';
import { Composer } from './components/Composer';
import { GlanceGrid, type GlanceTileSpec } from './components/GlanceGrid';
import { SummaryCard } from './components/SummaryCard';

export function HomeScreen() {
  return (
    <ScreenState>
      <HomeBody />
    </ScreenState>
  );
}

function HomeBody() {
  const { c } = useTheme();
  const app = useApp();
  const vm = app.vm!;
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();

  const go = (screen: TabName) => navigation.navigate(screen);

  // Follow the conversation as it grows.
  const scroller = useAutoScroll([app.chat.length, app.typing]);

  const tiles: GlanceTileSpec[] = [
    {
      key: 'meetings',
      icon: 'calendar',
      title: 'Meetings',
      detail: `${vm.glance.meetings} today`,
      bg: c.tealFill,
      onPress: () => go('Calendar'),
    },
    {
      key: 'tasks',
      icon: 'listCheck',
      title: 'Tasks',
      detail: `${app.tasksLeft} pending`,
      bg: c.periFill,
      onPress: () => go('Tasks'),
    },
    {
      key: 'urgent',
      icon: 'alertCircle',
      title: 'Urgent',
      detail: `${vm.glance.urgent} items`,
      bg: c.amberFill,
      fg: c.onAmber,
      tint: 'rgba(255,255,255,0.34)',
      detailWeight: 500,
      onPress: () => go('Tasks'),
    },
    {
      key: 'replies',
      icon: 'mail',
      title: 'Replies',
      detail: `${app.msgCount} waiting`,
      bg: c.roseFill,
      onPress: () => go('Chats'),
    },
  ];

  return (
    <Screen
      scrollRef={scroller}
      refreshing={app.loading}
      onRefresh={app.refresh}
      keyboardAware
      gap={SPACING.xxl}
    >
      <View>
        <Txt style={[TYPE.bodyMd, { color: c.ink3 }]}>
          {vm.user.greeting || `Welcome back, ${vm.user.firstName}`}
        </Txt>
        <Txt weight={700} style={[TYPE.h1, { color: c.ink }]}>
          {vm.user.today}
        </Txt>
      </View>

      <Section title="Today at a glance">
        <GlanceGrid tiles={tiles} />
      </Section>

      <Section title="Ask your AI">
        <Composer />
        <ChatThread messages={app.chat} typing={app.typing} />
      </Section>

      <Section title="Short summary">
        <SummaryCard rows={vm.summaryRows} onGo={go} />
      </Section>
    </Screen>
  );
}
