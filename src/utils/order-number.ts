/**
 * Order number generator (ORD-YYYYMMDD-XXX).
 */

/**
 * Generate a new order number.
 * @example generateOrderNumber(5) // "ORD-20260216-005"
 */
export function generateOrderNumber(sequenceNumber: number): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(3, '0');
  
  return `ORD-${year}${month}${day}-${seq}`;
}

/**
 * Generate a kitchen ticket number.
 * @example generateTicketNumber(12) // "KOT-20260216-012"
 */
export function generateTicketNumber(sequenceNumber: number): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(3, '0');
  
  return `KOT-${year}${month}${day}-${seq}`;
}