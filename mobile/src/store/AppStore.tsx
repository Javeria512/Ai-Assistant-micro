/**
 * The single app store: session, the loaded daily brief, and the local UI state
 * layered over it (checked-off tasks, dismissed messages, the chat thread).
 *
 * State transitions live in `reducer.ts`; this file owns the effects — restoring
 * the keychain session, wiring the API client's token source, loading the brief,
 * and the toast timer.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { ApiError, api, attachTokenSource } from '../api';
import { TOAST_MS } from '../constants/app';
import type { SessionInfo } from '../models/api';
import {
  AuthCancelled,
  buildViewModel,
  clearSession,
  loadSession,
  saveSession,
  signInWithMicrosoft,
  toSession,
  type StoredSession,
} from '../services';
import { initialState, reducer } from './reducer';
import type { Store } from './types';

const AppContext = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // The client reads tokens through a ref so a refresh mid-flight always sees
  // the newest pair without re-registering the token source.
  const sessionRef = useRef<StoredSession | null>(null);
  sessionRef.current = state.session;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attachTokenSource({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refresh: async () => {
        const rt = sessionRef.current?.refreshToken;
        if (!rt) return null;
        try {
          const next = toSession(await api.refresh(rt));
          sessionRef.current = next;
          await saveSession(next);
          dispatch({ type: 'signedIn', session: next });
          return next.accessToken;
        } catch {
          return null;
        }
      },
      onUnauthorized: () => {
        clearSession();
        dispatch({ type: 'signedOut' });
      },
    });
  }, []);

  // Restore a stored session on cold start.
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadSession();
      if (alive) dispatch({ type: 'restored', session: stored });
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!state.toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: 'toast', text: null }), TOAST_MS);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [state.toast]);

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      // The brief is the screen data; the session tells us which sources the
      // granted Graph scopes actually cover.
      const [brief, session] = await Promise.all([
        api.dailyBrief(),
        api.session().catch(() => null as SessionInfo | null),
      ]);
      dispatch({ type: 'loaded', vm: buildViewModel(brief, session) });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not load your day.';
      dispatch({ type: 'loadError', message: msg });
    }
  }, []);

  useEffect(() => {
    if (state.auth === 'signedIn' && !state.vm && !state.loading && !state.error) {
      load();
    }
  }, [state.auth, state.vm, state.loading, state.error, load]);

  const signIn = useCallback(async () => {
    dispatch({ type: 'signingIn' });
    try {
      const session = await signInWithMicrosoft();
      sessionRef.current = session;
      await saveSession(session);
      dispatch({ type: 'signedIn', session });
    } catch (e) {
      if (e instanceof AuthCancelled) {
        dispatch({ type: 'authError', message: null });
        return;
      }
      dispatch({
        type: 'authError',
        message: e instanceof Error ? e.message : 'Sign-in failed.',
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    const rt = sessionRef.current?.refreshToken;
    // Best-effort server-side revoke; the local session goes either way.
    try {
      await api.logout(rt);
    } catch {
      /* offline or already revoked */
    }
    sessionRef.current = null;
    await clearSession();
    dispatch({ type: 'signedOut' });
  }, []);

  /**
   * The backend has no free-text Q&A endpoint, so a question runs the
   * assistant summary and answers with its narrative and highlights.
   */
  const ask = useCallback(async (raw: string) => {
    const text = (raw || '').trim();
    if (!text) return;
    dispatch({ type: 'askStart', text });
    try {
      const summary = await api.summary();
      const bullets = [summary.headline, ...summary.highlights].filter(Boolean);
      dispatch({
        type: 'askEnd',
        text:
          summary.narrative ||
          (bullets.length ? bullets.join('\n• ') : 'Nothing stands out right now.'),
        source: summary.ai_generated
          ? 'Generated from your Microsoft 365 data'
          : 'From your Microsoft 365 data',
      });
    } catch (e) {
      dispatch({
        type: 'askEnd',
        text:
          e instanceof ApiError ? e.message : 'I could not reach the assistant service.',
      });
    }
  }, []);

  const store = useMemo<Store>(() => {
    const messages = state.vm?.messages ?? [];
    const tasks = state.vm?.tasks ?? [];
    const doneCount = tasks.filter((t) => state.done[t.id]).length;

    const pct: Record<string, number> = {};
    for (const t of tasks) pct[t.id] = state.done[t.id] ? 100 : t.percent;

    const nameFor = (id: string) =>
      messages.find((m) => m.id === id)?.meta.split(' · ')[0] ?? 'them';

    return {
      ...state,
      msgCount: messages.filter((m) => !state.gone[m.id]).length,
      tasksLeft: Math.max(0, (state.vm?.glance.tasks ?? 0) - doneCount),
      pct,
      toggleDark: () => dispatch({ type: 'toggleDark' }),
      signIn: () => {
        signIn();
      },
      signOut: () => {
        signOut();
      },
      refresh: () => {
        load();
      },
      toggleTask: (id) => dispatch({ type: 'toggleTask', id }),
      setInput: (next) => dispatch({ type: 'setInput', value: next }),
      ask: (text) => {
        ask(text);
      },
      reply: (id) => dispatch({ type: 'remove', id, toast: `Replied to ${nameFor(id)}` }),
      snooze: (id) => dispatch({ type: 'remove', id, toast: 'Snoozed for 1 hour' }),
      undo: () => dispatch({ type: 'undo' }),
      openAlerts: () => dispatch({ type: 'openOverlay', overlay: { kind: 'alerts' } }),
      openDetail: (key) => dispatch({ type: 'openOverlay', overlay: { kind: 'detail', key } }),
      closeOverlay: () => dispatch({ type: 'closeOverlay' }),
      confirmSheet: () => {
        const ov = state.overlay;
        if (!ov || ov.kind !== 'detail') return;
        if (messages.some((m) => m.id === ov.key)) {
          dispatch({ type: 'remove', id: ov.key, toast: `Replied to ${nameFor(ov.key)}` });
        } else {
          dispatch({ type: 'closeOverlay' });
          dispatch({ type: 'toast', text: 'Done.' });
        }
      },
    };
  }, [state, signIn, signOut, load, ask]);

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppStoreProvider>');
  return ctx;
}
