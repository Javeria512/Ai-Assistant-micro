/**
 * Presentation formatting — times, dates, initials, plurals.
 *
 * Pure and dependency-free, so they are cheap to unit test and safe to call
 * from a mapper, a component, or a reducer alike.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** `09:30am` — the compact form used on rails and metadata rows. */
export function clockTime(iso: string | null): string {
  const d = parseDate(iso);
  if (!d) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(d.getMinutes())}${h < 12 ? 'am' : 'pm'}`;
}

/** `9:30 AM` — the roomier form used in the calendar hero. */
export function clockTimeWide(iso: string | null): string {
  const d = parseDate(iso);
  if (!d) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** `in 25 minutes` / `in 2 hours` / `now` / `started`. */
export function relativeMinutes(mins: number | null | undefined): string {
  if (mins == null) return '';
  const m = Math.round(mins);
  if (m < 0) return 'started';
  if (m === 0) return 'now';
  if (m < 60) return `in ${m} ${plural(m, 'minute')}`;
  const h = Math.round(m / 60);
  return `in ${h} ${plural(h, 'hour')}`;
}

/** `5 August 2026`, in the device's locale ordering. */
export function longDate(iso: string | null): string {
  const d = iso ? parseDate(iso) : new Date();
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** `Dana Cole` → `DC`; a single name gives its first two letters. */
export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** `plural(1, 'event')` → `event`; `plural(2, 'event')` → `events`. */
export function plural(count: number, word: string, suffix = 's'): string {
  return count === 1 ? word : `${word}${suffix}`;
}

/** `countOf(3, 'event')` → `3 events`. */
export function countOf(count: number, word: string, suffix = 's'): string {
  return `${count} ${plural(count, word, suffix)}`;
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
