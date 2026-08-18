import React, { useState } from 'react';
import { EmptyState, ScreenState } from '../../components/feedback';
import { FilterRow, Screen } from '../../components/layout';
import { ALL_FILTER, CHAT_FILTERS, type ChatFilter } from '../../constants';
import type { MessageCard } from '../../models/view';
import { useApp } from '../../store';
import { SPACING } from '../../theme';
import { MessageCardView } from './components/MessageCardView';

export function ChatsScreen() {
  return (
    <ScreenState>
      <ChatsBody />
    </ScreenState>
  );
}

/** Which messages a filter admits. `All` shows everything not dismissed. */
function matchesFilter(m: MessageCard, filter: ChatFilter): boolean {
  switch (filter) {
    case 'Urgent':
      return m.urgent;
    case 'Email':
      return m.channel === 'Outlook';
    case 'Teams':
      return m.channel === 'Teams';
    default:
      return true;
  }
}

function ChatsBody() {
  const app = useApp();
  const [filter, setFilter] = useState<ChatFilter>(ALL_FILTER);

  const visible = app.vm!.messages.filter(
    (m) => !app.gone[m.id] && matchesFilter(m, filter),
  );

  return (
    <Screen
      refreshing={app.loading}
      onRefresh={app.refresh}
      gap={SPACING.md}
      topInset={0}
      header={
        <FilterRow
          options={CHAT_FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Filter messages"
        />
      }
    >
      {visible.map((m) => (
        <MessageCardView
          key={m.id}
          message={m}
          onOpen={() => app.openDetail(m.id)}
          onReply={() => app.reply(m.id)}
          onSnooze={() => app.snooze(m.id)}
        />
      ))}

      {visible.length === 0 && (
        <EmptyState
          title="All clear"
          body={
            app.msgCount === 0
              ? "Nothing is waiting on you. I'll surface the next thing that matters."
              : `Nothing in ${filter.toLowerCase()} right now.`
          }
        />
      )}
    </Screen>
  );
}
