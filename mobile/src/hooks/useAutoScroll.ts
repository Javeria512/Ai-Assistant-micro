import { useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Keeps a scroll view pinned to its end as content is appended — the chat
 * thread following a new answer.
 *
 * The delay lets the newly added rows lay out before the scroll is measured;
 * without it the view scrolls to where the end *was*.
 */
export function useAutoScroll(deps: unknown[], delayMs = 80) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), delayMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs]);

  return ref;
}
