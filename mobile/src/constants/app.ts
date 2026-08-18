/** App-wide behavioural constants. */

/** How long the undo toast stays up, in ms. */
export const TOAST_MS = 3600;

export const APP_VERSION = 'Version 2.4.0 · read-only Microsoft 365 access';

/** How much of a bottom sheet's height each kind is allowed, upright. */
export const SHEET_RATIO = {
  alerts: 0.72,
  detail: 0.84,
} as const;

/** Deep link the OAuth callback bounces back to; must match FRONTEND_REDIRECT_URI. */
export const AUTH_REDIRECT = 'aiassistant://auth';
