import React from 'react';
import { View } from 'react-native';
import { EmptyState, ScreenState } from '../../components/feedback';
import { Screen, Section, SectionNote } from '../../components/layout';
import { Txt } from '../../components/ui';
import { useApp } from '../../store';
import { SPACING, TYPE, useTheme } from '../../theme';
import { countOf } from '../../utils';
import { AgendaList } from './components/AgendaList';
import { NextUpCard } from './components/NextUpCard';
import { WeekStrip } from './components/WeekStrip';

export function CalendarScreen() {
  return (
    <ScreenState>
      <CalendarBody />
    </ScreenState>
  );
}

function CalendarBody() {
  const { c } = useTheme();
  const app = useApp();
  const vm = app.vm!;

  const openEvent = (id: string) => app.openDetail(`meeting:${id}`);

  return (
    <Screen refreshing={app.loading} onRefresh={app.refresh} gap={SPACING.xl}>
      <View>
        <Txt style={[TYPE.bodyMd, { color: c.ink3 }]}>Today</Txt>
        <Txt weight={700} style={[TYPE.h1, { color: c.ink }]}>
          {vm.user.today}
        </Txt>
      </View>

      <WeekStrip days={vm.week} />

      {!!vm.nextUp && (
        <NextUpCard event={vm.nextUp} onOpen={() => openEvent(vm.nextUp!.id)} />
      )}

      <Section
        title="Today's schedule"
        trailing={<SectionNote>{countOf(vm.agenda.length, 'event')}</SectionNote>}
      >
        {vm.agenda.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing scheduled"
            body="Your calendar is clear for today."
          />
        ) : (
          <AgendaList events={vm.agenda} onOpen={openEvent} />
        )}
      </Section>
    </Screen>
  );
}
