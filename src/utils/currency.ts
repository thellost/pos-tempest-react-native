/**
 * IDR currency formatting utilities.
 */

/**
 * Format a number as Indonesian Rupiah.
 * @example formatIDR(150000) // "Rp150.000"
 */
export function formatIDR(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`;
}

/**
 * Format with decimal precision (for calculations).
 * @example formatIDRDecimal(150000.50) // "Rp150.000,50"
 */
export function formatIDRDecimal(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}