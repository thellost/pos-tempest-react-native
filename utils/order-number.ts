/**
 * Order number generator (ORD-YYMMDD-{deviceId6}-{seq}).
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
 * Builds a device-scoped date prefix for order/ticket numbers.
 * Format: {type}-YYMMDD-{deviceId6}
 *
 * @param type - 'ORD' for orders, 'KOT' for kitchen tickets
 * @returns e.g. "ORD-260223-A1B2C3"
 * @internal
 */
async function buildDatePrefix(type: 'ORD' | 'KOT'): Promise<string> {
  const today = nowAppLocalDate();
  const year = String(today.getFullYear()).slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const deviceShortId = await getShortDeviceId();
  return `${type}-${year}${month}${day}-${deviceShortId}`;
}

/**
 * Generate a new order number with device-scoped auto-incrementing sequence.
 * Format: ORD-YYMMDD-{deviceId6}-{seq}
 * @example generateOrderNumber() // "ORD-260223-A1B2C3-001"
 */
export async function generateOrderNumber(): Promise<string> {
  const datePrefix = await buildDatePrefix('ORD');
  const result = await powersync.getOptional<{ count: number }>(
    `SELECT COUNT(*) as count FROM orders WHERE order_number LIKE ?`,
    [`${datePrefix}%`]
  );
  const seq = String((result?.count || 0) + 1).padStart(3, '0');
  return `${datePrefix}-${seq}`;
}

/**
 * Generate a kitchen ticket number with device-scoped auto-incrementing sequence.
 * Format: KOT-YYMMDD-{deviceId6}-{seq}
 * @example generateTicketNumber() // "KOT-260223-A1B2C3-001"
 */
export async function generateTicketNumber(): Promise<string> {
  const datePrefix = await buildDatePrefix('KOT');
  const result = await powersync.getOptional<{ count: number }>(
    `SELECT COUNT(*) as count FROM kitchen_order_tickets WHERE ticket_number LIKE ?`,
    [`${datePrefix}%`]
  );
  const seq = String((result?.count || 0) + 1).padStart(3, '0');
  return `${datePrefix}-${seq}`;
}