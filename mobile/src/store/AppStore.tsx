import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { api, ApiError, attachTokenSource } from '../api/client';
import type { SessionInfo } from '../api/types';
import {
  AuthCancelled,
  clearSession,
  loadSession,
  saveSession,
  signInWithMicrosoft,
  StoredSession,
  toSession,
} from '../auth/session';
import { buildViewModel, ViewModel } from '../data/adapters';
import { TOAST_MS } from '../data/content';

export type ChatMessage = { role: 'user' | 'ai'; text: string; source?: string };

/** `key` indexes into `vm.sheets`. */
export type Overlay = { kind: 'alerts' } | { kind: 'detail'; key: string } | null;

export type AuthState = 'restoring' | 'signedOut' | 'signedIn';

type State = {
  dark: boolean;
  auth: AuthState;
  session: StoredSession | null;
  signingIn: boolean;
  authError: string | null;

  vm: ViewModel | null;
  loading: boolean;
  error: string | null;

  // Local, per-session UI state layered over server data.
  done: Record<string, boolean>;
  gone: Record<string, boolean>;
  lastGone: string | null;
  chat: ChatMessage[];
  typing: boolean;
  input: string;
  toast: string | null;
  overlay: Overlay;
};

const initial: State = {
  dark: false,
  auth: 'restoring',
  session: null,
  signingIn: false,
  authError: null,
  vm: null,
  loading: false,
  error: null,
  done: {},
  gone: {},
  lastGone: null,
  chat: [],
  typing: false,
  input: '',
  toast: null,
  overlay: null,
};

type Action =
  | { type: 'toggleDark' }
  | { type: 'restored'; session: StoredSession | null }
  | { type: 'signingIn' }
  | { type: 'signedIn'; session: StoredSession }
  | { type: 'authError'; message: string | null }
  | { type: 'signedOut' }
  | { type: 'loading' }
  | { type: 'loaded'; vm: ViewModel }
  | { type: 'loadError'; message: string }
  | { type: 'toggleTask'; id: string }
  | { type: 'setInput'; value: string }
  | { type: 'askStart'; text: string }
  | { type: 'askEnd'; text: string; source?: string }
  | { type: 'remove'; id: string; toast: string }
  | { type: 'undo' }
  | { type: 'openOverlay'; overlay: Overlay }
  | { type: 'closeOverlay' }
  | { type: 'toast'; text: string | null };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'toggleDark':
      return { ...s, dark: !s.dark };

    case 'restored':
      return a.session
        ? { ...s, auth: 'signedIn', session: a.session }
        : { ...s, auth: 'signedOut', session: null };

    case 'signingIn':
      return { ...s, signingIn: true, authError: null };

    case 'signedIn':
      return { ...s, auth: 'signedIn', session: a.session, signingIn: false, authError: null };

    case 'authError':
      return { ...s, signingIn: false, authError: a.message };

    // Signing out clears everything but the chosen appearance.
    case 'signedOut':
      return { ...initial, dark: s.dark, auth: 'signedOut' };

    case 'loading':
      return { ...s, loading: true, error: null };

    case 'loaded':
      return { ...s, loading: false, error: null, vm: a.vm };

    case 'loadError':
      return { ...s, loading: false, error: a.message };

    case 'toggleTask':
      return { ...s, done: { ...s.done, [a.id]: !s.done[a.id] } };

    case 'setInput':
      return { ...s, input: a.value };

    case 'askStart':
      return { ...s, chat: [...s.chat, { role: 'user', text: a.text }], input: '', typing: true };

    case 'askEnd':
      return {
        ...s,
        typing: false,
        chat: [...s.chat, { role: 'ai', text: a.text, source: a.source }],
      };

    case 'remove':
      return {
        ...s,
        gone: { ...s.gone, [a.id]: true },
        lastGone: a.id,
        overlay: null,
        toast: a.toast,
      };

    case 'undo':
      if (!s.lastGone) return s;
      return {
        ...s,
        gone: { ...s.gone, [s.lastGone]: false },
        lastGone: null,
        toast: null,
      };

    case 'openOverlay':
      return { ...s, overlay: a.overlay };

    case 'closeOverlay':
      return { ...s, overlay: null };

    case 'toast':
      return { ...s, toast: a.text };
  }
}

type Store = State & {
  msgCount: number;
  tasksLeft: number;
  /** 0–100 per task id; a local check-off pins it to 100. */
  pct: Record<string, number>;
  toggleDark: () => void;
  signIn: () => void;
  signOut: () => void;
  refresh: () => void;
  toggleTask: (id: string) => void;
  setInput: (value: string) => void;
  ask: (text: string) => void;
  reply: (id: string) => void;
  snooze: (id: string) => void;
  undo: () => void;
  openAlerts: () => void;
  openDetail: (key: string) => void;
  closeOverlay: () => void;
  confirmSheet: () => void;
};

const AppContext = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

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
        void clearSession();
        dispatch({ type: 'signedOut' });
      },
    });
  }, []);

  // Restore a stored session on cold start.
  useEffect(() => {
    let alive = true;
    void (async () => {
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
      void load();
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
      const s = await api.summary();
      const body =
        s.narrative ??
        [s.headline, ...s.highlights].filter(Boolean).join('\n• ') ??
        'Nothing stands out right now.';
      dispatch({
        type: 'askEnd',
        text: body,
        source: s.ai_generated
          ? 'Generated from your Microsoft 365 data'
          : 'From your Microsoft 365 data',
      });
    } catch (e) {
      dispatch({
        type: 'askEnd',
        text: e instanceof ApiError ? e.message : 'I could not reach the assistant service.',
      });
    }
  }, []);

  const value = useMemo<Store>(() => {
    const messages = state.vm?.messages ?? [];
    const tasks = state.vm?.tasks ?? [];
    const msgCount = messages.filter((m) => !state.gone[m.id]).length;
    const doneCount = tasks.filter((t) => state.done[t.id]).length;

    const pct: Record<string, number> = {};
    for (const t of tasks) pct[t.id] = state.done[t.id] ? 100 : t.percent;

    const nameFor = (id: string) =>
      messages.find((m) => m.id === id)?.meta.split(' · ')[0] ?? 'them';

    return {
      ...state,
      msgCount,
      tasksLeft: Math.max(0, (state.vm?.glance.tasks ?? 0) - doneCount),
      pct,
      toggleDark: () => dispatch({ type: 'toggleDark' }),
      signIn: () => void signIn(),
      signOut: () => void signOut(),
      refresh: () => void load(),
      toggleTask: (id) => dispatch({ type: 'toggleTask', id }),
      setInput: (value) => dispatch({ type: 'setInput', value }),
      ask: (t) => void ask(t),
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

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppStoreProvider>');
  return ctx;
}
