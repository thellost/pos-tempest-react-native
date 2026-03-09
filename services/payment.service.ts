import { AUDIT_ACTION, ORDER_STATUS, PAYMENT_STATUS, TABLE_STATUS } from '@/constants/enums';
import type { Discount, Order, OrderDiscount, Payment } from '@/db/models';
import { powersync } from '@/db/provider';
import { insertAuditLog } from '@/services/audit.service';
import { applyDiscount as calcDiscountAmount } from '@/services/calculator.service';
import { calculateOrderTotals } from '@/services/order.service';

/**
 * Payment Service
 * Handles discount application, payment processing, and order completion.
 * All DB operations use PowerSync for offline-first support.
 */

// ── Discount operations ─────────────────────────────────────────────────────

/**
 * Applies a discount to an order.
 * Replaces any existing discount. Recalculates order totals.
 *
 * @param orderId   - The order to discount
 * @param discountId - The discount record to apply
 * @param appliedBy  - User ID of the staff member applying the discount
 */
export async function applyOrderDiscount(
  orderId: number,
  discountId: number,
  appliedBy: number,
): Promise<void> {
  const now = new Date().toISOString();

  const discount = await powersync.getOptional<Discount>(
    `SELECT * FROM discounts WHERE id = ? AND is_active = 1`,
    [discountId],
  );

  if (!discount) {
    throw new Error('Discount not found or inactive');
  }

  if (discount.valid_from && new Date() < new Date(discount.valid_from)) {
    throw new Error('Discount is not yet valid');
  }

  if (discount.valid_until && new Date() > new Date(discount.valid_until)) {
    throw new Error('Discount has expired');
  }

  const order = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId],
  );

  if (!order) {
    throw new Error('Order not found');
  }

  const discountAmount = calcDiscountAmount(order.subtotal, discount);

  if (
    discountAmount === 0 &&
    discount.min_order_amount !== null &&
    order.subtotal < discount.min_order_amount
  ) {
    throw new Error(
      `Minimum order of ${discount.min_order_amount} required for this discount`,
    );
  }

  // Replace any existing discount first
  await removeOrderDiscount(orderId);

  const maxIdRow = await powersync.getOptional<{ max_id: number }>(
    `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM order_discounts`,
  );
  const newId = (parseInt(String(maxIdRow?.max_id || '0'), 10) + 1).toString();

  await powersync.execute(
    `INSERT INTO order_discounts (
       id, order_id, discount_id, discount_name, discount_type,
       discount_value, applied_amount, applied_by, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      orderId,
      discountId,
      discount.name,
      discount.discount_type,
      discount.value,
      discountAmount,
      appliedBy,
      now,
    ],
  );

  await powersync.execute(
    `UPDATE orders SET discount_amount = ?, updated_at = ? WHERE id = ?`,
    [discountAmount, now, orderId],
  );

  await calculateOrderTotals(orderId);

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'order_discounts',
    recordId: orderId,
    userId: appliedBy,
    newValues: {
      discount_name: discount.name,
      discount_type: discount.discount_type,
      applied_amount: discountAmount,
    },
    description: `Discount applied: ${discount.name} (${discountAmount}) to order ${orderId}`,
  });

  console.log('[PaymentService] Applied discount:', discount.name, 'amount:', discountAmount);
}

/**
 * Removes any applied discount from an order.
 * Resets discount_amount to 0 and recalculates totals.
 */
export async function removeOrderDiscount(orderId: number): Promise<void> {
  const now = new Date().toISOString();

  await powersync.execute(`DELETE FROM order_discounts WHERE order_id = ?`, [orderId]);

  await powersync.execute(
    `UPDATE orders SET discount_amount = 0, updated_at = ? WHERE id = ?`,
    [now, orderId],
  );

  await calculateOrderTotals(orderId);

  void insertAuditLog({
    action: AUDIT_ACTION.DELETE,
    tableName: 'order_discounts',
    recordId: orderId,
    description: `Discount removed from order ${orderId}`,
  });

  console.log('[PaymentService] Removed discount from order:', orderId);
}

/**
 * Gets the currently applied discount for an order, if any.
 */
export async function getOrderDiscount(orderId: number): Promise<OrderDiscount | null> {
  return powersync.getOptional<OrderDiscount>(
    `SELECT * FROM order_discounts WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
}

/**
 * Gets all active discounts that are within their valid date range.
 * Suitable for populating the discount selector modal.
 */
export async function getActiveDiscounts(): Promise<Discount[]> {
  const now = new Date().toISOString();

  return powersync.getAll<Discount>(
    `SELECT * FROM discounts
     WHERE is_active = 1
       AND (valid_from IS NULL OR valid_from <= ?)
       AND (valid_until IS NULL OR valid_until >= ?)
     ORDER BY name ASC`,
    [now, now],
  );
}

// ── Payment operations ──────────────────────────────────────────────────────

/**
 * Gets all recorded payments for an order, ordered by time.
 */
export async function getOrderPayments(orderId: number): Promise<Payment[]> {
  return powersync.getAll<Payment>(
    `SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at ASC`,
    [orderId],
  );
}

/**
 * Calculates the change to return for a cash payment.
 * Pure function — no side effects.
 *
 * @param totalDue     - Amount still owed by the customer
 * @param cashReceived - Cash tendered by the customer
 * @returns The change amount (0 if insufficient cash)
 */
export function calculateChange(totalDue: number, cashReceived: number): number {
  return Math.max(0, cashReceived - totalDue);
}

/**
 * Records a payment against an order.
 * Updates order.payment_status to 'partial' or 'paid' based on remaining balance.
 * Does NOT mark the order complete — call `completeOrder()` after all payments.
 *
 * @param orderId         - The order being paid
 * @param shiftId         - Active shift (nullable for manager overrides)
 * @param method          - Payment method enum value
 * @param amount          - Amount tendered
 * @param changeAmount    - Change given back (cash only, default 0)
 * @param referenceNumber - Receipt/ref number for card/QRIS payments
 */
export async function processPayment(
  orderId: number,
  shiftId: number | null,
  method: string,
  amount: number,
  changeAmount: number = 0,
  referenceNumber: string | null = null,
): Promise<Payment> {
  const now = new Date().toISOString();

  const maxIdRow = await powersync.getOptional<{ max_id: number }>(
    `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM payments`,
  );
  const newId = (parseInt(String(maxIdRow?.max_id || '0'), 10) + 1).toString();

  await powersync.execute(
    `INSERT INTO payments (
       id, order_id, shift_id, payment_method, amount,
       change_amount, reference_number, paid_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, orderId, shiftId, method, amount, changeAmount, referenceNumber, now],
  );

  // Update payment_status: paid if fully covered, partial otherwise
  const row = await powersync.getOptional<{ total_paid: number; order_total: number }>(
    `SELECT
       COALESCE(SUM(p.amount), 0) AS total_paid,
       o.total                   AS order_total
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.id = ?
     GROUP BY o.id`,
    [orderId],
  );

  const paymentStatus =
    row && row.total_paid >= row.order_total ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIAL;

  await powersync.execute(
    `UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?`,
    [paymentStatus, now, orderId],
  );

  const payment = await powersync.getOptional<Payment>(
    `SELECT * FROM payments WHERE id = ?`,
    [newId],
  );

  if (!payment) {
    throw new Error('Failed to create payment record');
  }

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'payments',
    recordId: parseInt(newId, 10),
    newValues: {
      order_id: orderId,
      shift_id: shiftId,
      method,
      amount,
      change_amount: changeAmount,
      reference_number: referenceNumber,
    },
    description: `Payment: ${method} ${amount} for order ${orderId}`,
  });

  console.log('[PaymentService] Processed payment:', method, amount);
  return payment;
}

// ── Order completion ────────────────────────────────────────────────────────

/**
 * Marks an order as completed after all payments are recorded.
 * - Sets order status → COMPLETED, payment_status → PAID
 * - Frees the table (if dine-in)
 * - Awards loyalty points to the customer (1 pt per 1,000 IDR)
 *
 * @param orderId - The order to complete
 */
export async function completeOrder(orderId: number): Promise<void> {
  const now = new Date().toISOString();

  const order = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId],
  );

  if (!order) {
    throw new Error('Order not found');
  }

  await powersync.execute(
    `UPDATE orders
     SET status = ?, payment_status = ?, updated_at = ?
     WHERE id = ?`,
    [ORDER_STATUS.COMPLETED, PAYMENT_STATUS.PAID, now, orderId],
  );

  // Free the table for dine-in orders
  if (order.table_id) {
    await powersync.execute(
      `UPDATE tables SET status = ?, updated_at = ? WHERE id = ?`,
      [TABLE_STATUS.AVAILABLE, now, order.table_id],
    );
  }

  // Award loyalty points: 1 point per 1,000 IDR spent
  if (order.customer_id) {
    const points = Math.floor(order.total / 1000);
    await powersync.execute(
      `UPDATE customers
       SET loyalty_points = loyalty_points + ?,
           total_visits   = total_visits + 1,
           total_spent    = total_spent + ?,
           updated_at     = ?
       WHERE id = ?`,
      [points, order.total, now, order.customer_id],
    );
  }

  void insertAuditLog({
    action: AUDIT_ACTION.STATUS_CHANGE,
    tableName: 'orders',
    recordId: orderId,
    newValues: { status: ORDER_STATUS.COMPLETED, payment_status: PAYMENT_STATUS.PAID },
    description: `Order completed: ${orderId}`,
  });

  console.log('[PaymentService] Completed order:', orderId);
}
