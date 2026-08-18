/**
 * Static UI copy.
 *
 * Everything the user sees as *data* comes from the FastAPI backend via
 * `src/api` and is reshaped in `services/viewModel.ts`. What is left here is the
 * chrome the design specifies regardless of which account is signed in.
 */

/** Starter prompts under "Ask your AI". */
export const SUGGESTIONS = [
  "Today's summary",
  'What needs me first?',
  'Anything urgent?',
] as const;

export const CHAT_FILTERS = ['All', 'Urgent', 'Email', 'Teams'] as const;

export type ChatFilter = (typeof CHAT_FILTERS)[number];

/** The default option every filter row opens on. */
export const ALL_FILTER = 'All';

/** Read-only promises shown under the login CTA. */
export const LOGIN_PROMISES = [
  'Outlook, Teams, Calendar, To Do and OneDrive',
  'Read-only. Nothing leaves your tenant.',
] as const;

/** Preference rows the profile screen renders, in order. */
export const SOURCE_SCOPES = [
  { name: 'Outlook', scope: 'Mail.Read' },
  { name: 'Teams', scope: 'Chat.Read' },
  { name: 'Calendar', scope: 'Calendars.Read' },
  { name: 'To Do', scope: 'Tasks.ReadWrite' },
  { name: 'Profile', scope: 'User.Read' },
] as const;
