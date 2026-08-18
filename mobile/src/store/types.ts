/** The store's state, actions, and the shape `useApp()` hands back. */

import type { ViewModel } from '../models/view';
import type { StoredSession } from '../services/auth';

export type ChatMessage = { role: 'user' | 'ai'; text: string; source?: string };

/** `key` indexes into `vm.sheets`. */
export type Overlay = { kind: 'alerts' } | { kind: 'detail'; key: string } | null;

export type AuthState = 'restoring' | 'signedOut' | 'signedIn';

export type State = {
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

export type Action =
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

/** Values derived from state on every render rather than stored alongside it. */
export type Derived = {
  msgCount: number;
  tasksLeft: number;
  /** 0–100 per task id; a local check-off pins it to 100. */
  pct: Record<string, number>;
};

export type Actions = {
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

export type Store = State & Derived & Actions;
