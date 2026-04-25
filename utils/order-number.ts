/**
 * Order number generator (ORD-YYMMDD-{deviceId6}-{seq}{rand}).
 * Device-scoped to prevent collisions when multiple POS terminals sync.
 */

import { getOrCreateDeviceId } from '@/lib/device';
import { powersync } from '@/db/provider';
import { nowAppLocalDate } from '@/utils/date';

/**
 * Gets a 6-character short device ID from the full UUID.
 * Removes dashes and takes first 6 chars for readability.
 */
async function getShortDeviceId(): Promise<string> {
  try {
    const deviceId = await getOrCreateDeviceId();
    return deviceId.replace(/-/g, '').slice(0, 6).toUpperCase();
  } catch {
    return 'LOCAL';
  }
}

/**
 * Returns a 2-character uppercase hex random suffix.
 * Used as a tiebreaker so concurrent generations on the same device
 * don't collide on the unique order_number index.
 */
function randomSuffix(): string {
  return Math.floor(Math.random() * 256)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/**
 * Returns 1 + the maximum seq number found in the trailing
 * `-NNN` segment of order numbers matching the given prefix.
 *
 * Robust to voids/deletes (unlike COUNT(*)) and to gaps.
 */
async function nextSeqForPrefix(
  table: 'orders' | 'kitchen_order_tickets',
  column: 'order_number' | 'ticket_number',
  prefix: string,
): Promise<number> {
  const rows = await powersync.getAll<{ value: string }>(
    `SELECT ${column} as value FROM ${table} WHERE ${column} LIKE ?`,
    [`${prefix}%`],
  );
  let maxSeq = 0;
  for (const row of rows) {
    // Match the original 3-digit seq segment, optionally followed by `-XX` suffix.
    const match = /-(\d{3})(?:-[0-9A-F]{2})?$/i.exec(row.value);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return maxSeq + 1;
}

/**
 * Generate a new order number with device-scoped auto-incrementing sequence.
 * Format: ORD-YYMMDD-{deviceId6}-{seq}-{rand}
 * @example generateOrderNumber() // "ORD-260223-A1B2C3-001-7F"
 */
export async function generateOrderNumber(): Promise<string> {
  const today = nowAppLocalDate();
  const year = String(today.getFullYear()).slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const deviceShortId = await getShortDeviceId();
  const datePrefix = `ORD-${year}${month}${day}-${deviceShortId}`;

  const sequenceNumber = await nextSeqForPrefix('orders', 'order_number', datePrefix);
  const seq = String(sequenceNumber).padStart(3, '0');

  return `${datePrefix}-${seq}-${randomSuffix()}`;
}

/**
 * Generate a kitchen ticket number with device-scoped auto-incrementing sequence.
 * Format: KOT-YYMMDD-{deviceId6}-{seq}-{rand}
 * @example generateTicketNumber() // "KOT-260223-A1B2C3-001-7F"
 */
export async function generateTicketNumber(): Promise<string> {
  const today = nowAppLocalDate();
  const year = String(today.getFullYear()).slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const deviceShortId = await getShortDeviceId();
  const datePrefix = `KOT-${year}${month}${day}-${deviceShortId}`;

  const sequenceNumber = await nextSeqForPrefix(
    'kitchen_order_tickets',
    'ticket_number',
    datePrefix,
  );
  const seq = String(sequenceNumber).padStart(3, '0');

  return `${datePrefix}-${seq}-${randomSuffix()}`;
}