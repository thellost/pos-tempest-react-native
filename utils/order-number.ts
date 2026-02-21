/**
 * Order number generator (ORD-YYYYMMDD-XXX).
 */

import { powersync } from '@/db/provider';

/**
 * Generate a new order number with auto-incrementing sequence.
 * @example generateOrderNumber() // "ORD-20260216-001"
 */
export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `ORD-${year}${month}${day}`;
  
  // Get the count of orders created today
  const result = await powersync.getOptional<{ count: number }>(
    `SELECT COUNT(*) as count FROM orders WHERE order_number LIKE ?`,
    [`${datePrefix}%`]
  );
  
  const sequenceNumber = (result?.count || 0) + 1;
  const seq = String(sequenceNumber).padStart(3, '0');
  
  return `${datePrefix}-${seq}`;
}

/**
 * Generate a kitchen ticket number with auto-incrementing sequence.
 * @example generateTicketNumber() // "KOT-20260216-001"
 */
export async function generateTicketNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `KOT-${year}${month}${day}`;
  
  // Get the count of tickets created today
  const result = await powersync.getOptional<{ count: number }>(
    `SELECT COUNT(*) as count FROM kitchen_order_tickets WHERE ticket_number LIKE ?`,
    [`${datePrefix}%`]
  );
  
  const sequenceNumber = (result?.count || 0) + 1;
  const seq = String(sequenceNumber).padStart(3, '0');
  
  return `${datePrefix}-${seq}`;
}