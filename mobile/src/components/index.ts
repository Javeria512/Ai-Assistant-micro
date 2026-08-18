/**
 * Every shared component, grouped by role.
 *
 * * `ui` — primitives with no knowledge of app state
 * * `layout` — page structure and chrome
 * * `feedback` — loading, empty, error and toast surfaces
 * * `sheets` — the bottom-sheet shell and the two the app opens
 * * `animations` — the design's keyframe ports
 */

export * from './animations';
export * from './feedback';
export * from './layout';
export * from './sheets';
export * from './ui';
