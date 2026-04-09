/**
 * Timezone-aware date utilities.
 *
 * All functions use the app-configured timezone from settings (branch.timezone),
 * NOT the device system timezone. See utils/timezone.ts.
 */

import { getAppTimezone } from './timezone';

/**
 * Normalises a timestamp string to UTC milliseconds.
 *
 * Handles two formats that arrive from the DB:
 *  - "2026-03-22T05:34:11.893Z"  (local insert, already UTC)
 *  - "2026-03-22 05:34:11.893"   (Postgres timestamptz via PowerSync, no Z)
 *
 * Postgres timestamptz is always UTC — we append Z so JavaScript does not
 * reinterpret it as device-local time.
 */
function toUtcMs(ts: string): number {
  const t = ts.trim().replace(' ', 'T');
  const normalised = /Z$|[+-]\d{2}:?\d{2}$/.test(t) ? t : t + 'Z';
  return new Date(normalised).getTime();
}

/** Extracts date/time parts for a given date in the app timezone. */
function tzParts(date: Date, tz: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, parseInt(p.value, 10)]));
}

/**
 * Returns the UTC offset in milliseconds for the app timezone at a given date.
 * e.g. for Asia/Jakarta (+07:00): returns 7 * 3600 * 1000
 */
function getTZOffsetMs(date: Date = new Date()): number {
  const tz = getAppTimezone();
  const p = tzParts(date, tz);
  const tzWallMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return tzWallMs - date.getTime();
}

/**
 * Returns a Date object where .getFullYear(), .getMonth(), .getDate(),
 * .getHours(), .getMinutes() etc. all reflect the current time in the
 * app timezone (from settings).
 *
 * Use this as the `value` for DateTimePicker so the picker displays the
 * correct time regardless of the device's system timezone.
 */
export function nowAppLocalDate(): Date {
  const p = tzParts(new Date(), getAppTimezone());
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Converts a stored UTC ISO datetime string to a "picker Date" whose
 * wall-clock values (.getHours() etc.) reflect the app timezone.
 *
 * Use this when pre-populating DateTimePicker from a stored datetime.
 */
export function isoToPickerDate(iso: string): Date {
  const p = tzParts(new Date(iso), getAppTimezone());
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Converts a "picker Date" (whose wall-clock values represent app timezone time)
 * to a proper UTC ISO string for server storage.
 *
 * Inverse of isoToPickerDate / nowAppLocalDate.
 */
export function pickerDateToISO(date: Date): string {
  const offsetMs = getTZOffsetMs(date);
  const utcMs = Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds(),
  ) - offsetMs;
  return new Date(utcMs).toISOString();
}

/**
 * Returns YYYY-MM-DD string for a date in the app timezone.
 * Defaults to now if no date is provided.
 */
export function getAppDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getAppTimezone(),
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/**
 * Parses a timestamp string that represents app-timezone wall-clock time
 * (no Z/offset marker) to UTC epoch milliseconds.
 * Used internally by the picker helpers (isoToPickerDate, pickerDateToISO).
 *
 * For elapsed-time calculations, use new Date(ts).getTime() directly
 * since all app-stored timestamps already carry a Z suffix.
 */
export function parseTimestamp(ts: string): number {
  const trimmed = ts.trim();
  if (/Z$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).getTime();
  }
  // No TZ marker → treat as app timezone local time
  const normalized = trimmed.replace(' ', 'T');
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return new Date(trimmed).getTime();
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const fakeDate = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - getTZOffsetMs(fakeDate);
}

/**
 * Returns elapsed minutes between a stored UTC ISO timestamp and now.
 * Returns 0 if the timestamp is missing or in the future.
 */
export function getElapsedMinutes(timestamp: string | null | undefined): number {
  if (!timestamp) return 0;
  return Math.max(0, Math.floor((Date.now() - toUtcMs(timestamp)) / 1000 / 60));
}

/**
 * Get the current date/time as a Date object.
 */
export function now(): Date {
  return new Date();
}

/**
 * Format date for receipt printing — fixed numeric format.
 * @example formatReceiptDate(new Date()) // "01-01-2026, 16:30"
 */
export function formatReceiptDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(toUtcMs(date)) : date;
  const tz = getAppTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('day')}-${get('month')}-${get('year')}, ${get('hour')}:${get('minute')}`;
}

/**
 * Format date for display in the app timezone.
 * @example formatDate(new Date()) // "16 Feb 2026, 14:30"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(toUtcMs(date)) : date;
  return d.toLocaleString('id-ID', {
    timeZone: getAppTimezone(),
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


/**
 * Format date as ISO string.
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Format a date as HH:mm in the app timezone.
 * @example formatTime('2026-02-16T07:30:00Z') // "14:30"
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(toUtcMs(date)) : date;
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: getAppTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Format elapsed time since an ISO timestamp as a human-readable string.
 * @example formatElapsed('2026-02-16T07:25:00Z') // "5m" or "1h 30m"
 */
export function formatElapsed(ts: string): string {
  const elapsed = Math.floor((Date.now() - toUtcMs(ts)) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
