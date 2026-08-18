/**
 * The pure half of the store: every state transition, with no I/O.
 *
 * Async work (sign-in, loading the brief, asking the assistant) lives in
 * `AppStore.tsx` and lands here as one of these actions.
 */

import type { Action, State } from './types';

export const initialState: State = {
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

export function reducer(s: State, a: Action): State {
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
      return {
        ...s,
        auth: 'signedIn',
        session: a.session,
        signingIn: false,
        authError: null,
      };

    case 'authError':
      return { ...s, signingIn: false, authError: a.message };

    // Signing out clears everything but the chosen appearance.
    case 'signedOut':
      return { ...initialState, dark: s.dark, auth: 'signedOut' };

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
      return {
        ...s,
        chat: [...s.chat, { role: 'user', text: a.text }],
        input: '',
        typing: true,
      };

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
