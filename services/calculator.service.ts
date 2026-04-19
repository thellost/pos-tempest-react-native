import { Config } from '@/constants/config';
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
 * Calculates rounding to the nearest precision unit.
 * Default is 1000 (nearest thousand IDR). Set to 1 for no rounding.
 *
 * @param total - The total before rounding
 * @param precision - Rounding unit (1 = exact, 10 = tens, 100 = hundreds, 1000 = thousands)
 * @returns Object with `roundingAmount` (can be negative) and `roundedTotal`
 */
export function calculateRounding(total: number, precision: number = Config.DEFAULT_ROUNDING_PRECISION): {
  roundingAmount: number;
  roundedTotal: number;
} {
  if (precision <= 1) return { roundingAmount: 0, roundedTotal: total };
  const roundedTotal = Math.round(total / precision) * precision;
  const roundingAmount = roundedTotal - total;
  return { roundingAmount, roundedTotal };
}
