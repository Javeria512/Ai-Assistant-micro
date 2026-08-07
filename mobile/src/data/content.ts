/**
 * Static UI copy and shared shapes.
 *
 * Everything the user sees as *data* now comes from the FastAPI backend via
 * `src/api` and is reshaped in `adapters.ts`. What is left here is the chrome
 * the design specifies regardless of which account is signed in.
 */

/** Body of a detail bottom sheet, whichever entity opened it. */
export type SheetContent = {
  title: string;
  meta: string;
  kicker: string;
  points: string[];
  source: string;
  hasReply: boolean;
  reply?: string;
  primary: string;
  secondary: string;
  /** Who a sent reply goes to — used in the toast. */
  name?: string;
};

/** Starter prompts under "Ask your AI". */
export const SUGGESTIONS = [
  "Today's summary",
  'What needs me first?',
  'Anything urgent?',
] as const;

export const CHAT_FILTERS = ['All', 'Urgent', 'Email', 'Teams'] as const;

/** How long the undo toast stays up. */
export const TOAST_MS = 3600;

export const APP_VERSION = 'Version 2.4.0 · read-only Microsoft 365 access';
