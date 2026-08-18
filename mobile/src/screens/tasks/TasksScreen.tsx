import React, { useMemo, useState } from 'react';
import { EmptyState, ScreenState } from '../../components/feedback';
import { FilterRow, Screen } from '../../components/layout';
import { ALL_FILTER } from '../../constants';
import { useApp } from '../../store';
import { SPACING } from '../../theme';
import { PriorityInsight } from './components/PriorityInsight';
import { TaskCardView } from './components/TaskCardView';

export function TasksScreen() {
  return (
    <ScreenState>
      <TasksBody />
    </ScreenState>
  );
}

function TasksBody() {
  const app = useApp();
  const vm = app.vm!;
  const [filter, setFilter] = useState<string>(ALL_FILTER);

  // Categories come from whichever To Do / Planner lists the user actually has.
  const filters = useMemo(() => [ALL_FILTER, ...vm.taskCategories], [vm.taskCategories]);
  const visible = vm.tasks.filter(
    (t) => filter === ALL_FILTER || t.category === filter,
  );

  return (
    <Screen
      refreshing={app.loading}
      onRefresh={app.refresh}
      gap={SPACING.md}
      topInset={0}
      header={
        <FilterRow
          options={filters}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Filter tasks"
        />
      }
    >
      {!!vm.priorityInsight && <PriorityInsight text={vm.priorityInsight} />}

      {visible.map((t) => (
        <TaskCardView
          key={t.id}
          task={t}
          done={!!app.done[t.id]}
          percent={app.pct[t.id] ?? t.percent}
          onToggle={() => app.toggleTask(t.id)}
        />
      ))}

      {/* The daily brief carries only pending work, so there is no completed
          list to show here — the empty state stands in for it. */}
      {visible.length === 0 && (
        <EmptyState
          title="Nothing pending"
          body={
            filter === ALL_FILTER
              ? 'You have no open tasks right now.'
              : `Nothing open in ${filter}.`
          }
        />
      )}
    </Screen>
  );
}
