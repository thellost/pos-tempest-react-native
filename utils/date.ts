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