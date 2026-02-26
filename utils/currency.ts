/**
 * IDR currency formatting utilities.
 */

const idFormatter = new Intl.NumberFormat('id-ID');
const idFormatterDecimal = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as Indonesian Rupiah.
 * @example formatIDR(150000) // "Rp150.000"
 */
export function formatIDR(amount: number): string {
  return `Rp${idFormatter.format(Math.round(amount))}`;
}

/**
 * Format with decimal precision (for calculations).
 * @example formatIDRDecimal(150000.50) // "Rp150.000,50"
 */
export function formatIDRDecimal(amount: number): string {
  return `Rp${idFormatterDecimal.format(amount)}`;
}