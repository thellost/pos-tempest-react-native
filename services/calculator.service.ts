import { DISCOUNT_TYPE } from '@/constants/enums';
import type { Discount, OrderItem } from '@/db/models';

/**
 * Calculator Service
 * Pure, side-effect-free calculation functions for order totals.
 * All functions are deterministic and easily unit-testable.
 * No database access — inputs are plain data, outputs are numbers.
 */

/**
 * Calculates the subtotal from a list of order items.
 * Excludes voided items.
 *
 * @param items - Array of order items
 * @returns Sum of `total` for all non-voided items
 */
export function calculateSubtotal(items: OrderItem[]): number {
  return items
    .filter((item) => !item.is_voided)
    .reduce((sum, item) => {
      const total =
        typeof item.total === 'string'
          ? parseFloat(item.total as unknown as string)
          : item.total;
      return sum + (isNaN(total) ? 0 : total);
    }, 0);
}

/**
 * Applies a discount to a subtotal.
 * Handles both percentage and fixed-amount discount types.
 * Respects `min_order_amount` and `max_discount_amount` constraints.
 *
 * @param subtotal - The subtotal before discount
 * @param discount - The discount to apply
 * @returns The discount amount (not the discounted subtotal)
 */
export function applyDiscount(subtotal: number, discount: Discount): number {
  // Check minimum order amount threshold
  if (discount.min_order_amount !== null && subtotal < discount.min_order_amount) {
    return 0;
  }

  let discountAmount = 0;

  if (discount.discount_type === DISCOUNT_TYPE.PERCENTAGE) {
    discountAmount = subtotal * (discount.value / 100);
  } else if (discount.discount_type === DISCOUNT_TYPE.FIXED_AMOUNT) {
    discountAmount = discount.value;
  }

  // Cap at max_discount_amount if configured
  if (discount.max_discount_amount !== null) {
    discountAmount = Math.min(discountAmount, discount.max_discount_amount);
  }

  // Discount cannot exceed the subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  return Math.max(0, discountAmount);
}

/**
 * Calculates tax (PPN) on the amount after discount.
 *
 * @param amountAfterDiscount - Subtotal minus any discount
 * @param taxRate - Tax rate as a percentage (e.g. 11 for 11%)
 * @returns Tax amount
 */
export function calculateTax(amountAfterDiscount: number, taxRate: number): number {
  if (taxRate <= 0 || amountAfterDiscount <= 0) return 0;
  return amountAfterDiscount * (taxRate / 100);
}

/**
 * Calculates service charge on the amount after discount.
 *
 * @param amountAfterDiscount - Subtotal minus any discount
 * @param serviceRate - Service charge rate as a percentage (e.g. 5 for 5%)
 * @returns Service charge amount
 */
export function calculateServiceCharge(
  amountAfterDiscount: number,
  serviceRate: number
): number {
  if (serviceRate <= 0 || amountAfterDiscount <= 0) return 0;
  return amountAfterDiscount * (serviceRate / 100);
}

/**
 * Calculates Indonesian rounding to the nearest 100 IDR.
 * Standard practice in Indonesian restaurants.
 *
 * Examples:
 *   - 45,250 → roundingAmount = +50, roundedTotal = 45,300
 *   - 45,350 → roundingAmount = -50, roundedTotal = 45,300 (wait, nearest 100 = 45,400)
 *   - 45,349 → roundingAmount = +51, roundedTotal = 45,400 (nearest 100)
 *
 * @param total - The total before rounding
 * @returns Object with `roundingAmount` (can be negative) and `roundedTotal`
 */
export function calculateRounding(total: number): {
  roundingAmount: number;
  roundedTotal: number;
} {
  const roundedTotal = Math.round(total / 100) * 100;
  const roundingAmount = roundedTotal - total;
  return { roundingAmount, roundedTotal };
}
