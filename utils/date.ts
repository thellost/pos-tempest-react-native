/**
 * Timezone-aware date utilities (Asia/Jakarta).
 */

/**
 * Get the current date/time as a Date object.
 */
export function now(): Date {
  return new Date();
}

/**
 * Format date for display.
 * @example formatDate(new Date()) // "16 Feb 2026, 14:30"
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
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
 * Format a date as HH:mm in Asia/Jakarta timezone.
 * @example formatTime('2026-02-16T07:30:00Z') // "14:30"
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    // Safe 24-hour fallback for environments without Intl locale support
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Format elapsed time since an ISO timestamp as a human-readable string.
 * @example formatElapsed('2026-02-16T07:25:00Z') // "5m" or "1h 30m"
 */
export function formatElapsed(isoString: string): string {
  const elapsed = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
