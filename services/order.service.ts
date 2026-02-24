import { ORDER_STATUS, PAYMENT_STATUS, TABLE_STATUS } from '@/constants/enums';
import type { MenuItem, Order, OrderItem, OrderItemModifier } from '@/db/models';
import { powersync } from '@/db/provider';
import { generateOrderNumber } from '@/utils/order-number';

/**
 * Selected modifier for an order item
 */
export interface SelectedModifier {
  modifier_id: number;
  modifier_name: string;
  modifier_group_name: string;
  extra_price: number;
}

/**
 * Order Service
 * Handles all order-related business logic:
 * - Creating orders
 * - Adding/removing/updating items
 * - Calculating totals (subtotal, tax, service charge, discounts, rounding)
 * - Voiding orders and items
 */

/**
 * Creates a new order
 */
export async function createOrder(
  branchId: number,
  tableId: number | null,
  cashierId: number,
  shiftId: number | null,
  orderType: string,
  guestCount: number | null
): Promise<Order> {
  const now = new Date().toISOString();

  if (tableId) {
    const existingOrder = await powersync.getOptional<Order>(
      `SELECT * FROM orders 
       WHERE table_id = ? AND status NOT IN (?, ?, ?)
       ORDER BY created_at DESC LIMIT 1`,
      [tableId, ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.SERVED]
    );

    if (existingOrder) {
      console.log('[OrderService] Found existing active order:', existingOrder.order_number);
      return existingOrder;
    }
  }

  const orderNumber = await generateOrderNumber();

  const maxIdRow = await powersync.getOptional<{ max_id: number }>(
    `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM orders`
  );
  const newId = ((maxIdRow?.max_id || 0) + 1).toString();

  await powersync.execute(
    `INSERT INTO orders (
      id, order_number, branch_id, table_id, cashier_id, customer_id, shift_id,
      order_type, status, guest_count, subtotal, discount_amount, tax_amount,
      service_charge, rounding_amount, total, payment_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      orderNumber,
      branchId,
      tableId,
      cashierId,
      null,
      shiftId,
      orderType,
      ORDER_STATUS.PENDING,
      guestCount,
      0,
      0,
      0,
      0,
      0,
      0,
      PAYMENT_STATUS.UNPAID,
      now,
      now,
    ]
  );

  if (tableId) {
    await powersync.execute(
      `UPDATE tables SET status = ?, updated_at = ? WHERE id = ?`,
      [TABLE_STATUS.OCCUPIED, now, tableId]
    );
  }

  const order = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [newId]
  );

  if (!order) {
    throw new Error('Failed to create order');
  }

  console.log('[OrderService] Created order:', orderNumber);
  return order;
}

/**
 * Confirms an order (moves from pending to confirmed)
 */
export async function confirmOrder(orderId: number): Promise<void> {
  const now = new Date().toISOString();

  await powersync.execute(
    `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`,
    [ORDER_STATUS.CONFIRMED, now, orderId]
  );

  console.log('[OrderService] Confirmed order:', orderId);
}

/**
 * Adds an item to an order
 */
export async function addItemToOrder(
  orderId: number,
  menuItem: MenuItem,
  quantity: number,
  modifiers: SelectedModifier[],
  notes: string | null = null,
  weight: number | null = null
): Promise<void> {
  const now = new Date().toISOString();

  // Calculate prices
  let unitPrice = menuItem.price;
  
  // For weight-based items, multiply price by weight
  if (menuItem.pricing_type === 'weight_based' && weight) {
    unitPrice = menuItem.price * weight;
  }

  // Calculate modifier total
  const modifierTotal = modifiers.reduce((sum, mod) => sum + mod.extra_price, 0);

  // Calculate item subtotal
  const subtotal = (unitPrice + modifierTotal) * quantity;

  const normalizedNotes = notes?.trim() ?? '';

  // Fast path: merge repeated plain taps into existing row instead of creating duplicates.
  // We only merge when there are no modifiers and no notes to avoid losing customization intent.
  if (modifiers.length === 0 && normalizedNotes.length === 0) {
    const existingItem = await powersync.getOptional<OrderItem>(
      `SELECT * FROM order_items
       WHERE order_id = ?
         AND menu_item_id = ?
         AND is_voided = 0
         AND COALESCE(notes, '') = ''
         AND modifier_total = 0
         AND unit_price = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId, menuItem.id, unitPrice]
    );

    if (existingItem) {
      const existingQty = typeof existingItem.quantity === 'string'
        ? parseInt(existingItem.quantity as unknown as string, 10)
        : existingItem.quantity;

      await updateItemQuantity(
        typeof existingItem.id === 'string' ? parseInt(existingItem.id as unknown as string, 10) : existingItem.id,
        existingQty + quantity
      );

      console.log('[OrderService] Merged item quantity:', menuItem.name, '+', quantity);
      return;
    }
  }

  // Get the next order item ID
  const maxIdRow = await powersync.getOptional<{ max_id: number }>(
    `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM order_items`
  );
  const newId = ((maxIdRow?.max_id || 0) + 1).toString();

  // Insert order item
  await powersync.execute(
    `INSERT INTO order_items (
      id, order_id, menu_item_id, menu_item_name, quantity, unit_of_measure,
      unit_price, modifier_total, subtotal, discount_amount, total, notes,
      is_voided, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      orderId,
      menuItem.id,
      menuItem.name,
      quantity,
      menuItem.unit_of_measure,
      unitPrice,
      modifierTotal,
      subtotal,
      0, // discount_amount
      subtotal, // total
      notes,
      0, // is_voided
      now,
    ]
  );

  // Insert order item modifiers
  for (const modifier of modifiers) {
    const modMaxIdRow = await powersync.getOptional<{ max_id: number }>(
      `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM order_item_modifiers`
    );
    const modId = ((modMaxIdRow?.max_id || 0) + 1).toString();

    await powersync.execute(
      `INSERT INTO order_item_modifiers (
        id, order_item_id, modifier_id, modifier_name, modifier_group_name, extra_price
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [modId, newId, modifier.modifier_id, modifier.modifier_name, modifier.modifier_group_name, modifier.extra_price]
    );
  }

  // Recalculate order totals
  await calculateOrderTotals(orderId);

  console.log('[OrderService] Added item to order:', menuItem.name, 'x', quantity);
}

/**
 * Removes an item from an order
 */
export async function removeItemFromOrder(orderItemId: number): Promise<void> {
  const orderItem = await powersync.getOptional<OrderItem>(
    `SELECT * FROM order_items WHERE id = ?`,
    [orderItemId]
  );

  if (!orderItem) {
    throw new Error('Order item not found');
  }

  // Delete order item modifiers
  await powersync.execute(
    `DELETE FROM order_item_modifiers WHERE order_item_id = ?`,
    [orderItemId]
  );

  // Delete order item
  await powersync.execute(
    `DELETE FROM order_items WHERE id = ?`,
    [orderItemId]
  );

  // Recalculate order totals
  await calculateOrderTotals(orderItem.order_id);

  console.log('[OrderService] Removed item from order:', orderItemId);
}

/**
 * Updates the quantity of an order item
 */
export async function updateItemQuantity(orderItemId: number, newQuantity: number): Promise<void> {
  if (newQuantity <= 0) {
    await removeItemFromOrder(orderItemId);
    return;
  }

  const orderItem = await powersync.getOptional<OrderItem>(
    `SELECT * FROM order_items WHERE id = ?`,
    [orderItemId]
  );

  if (!orderItem) {
    throw new Error('Order item not found');
  }

  // Recalculate subtotal and total
  const itemPrice = orderItem.unit_price + orderItem.modifier_total;
  const newSubtotal = itemPrice * newQuantity;

  await powersync.execute(
    `UPDATE order_items 
     SET quantity = ?, subtotal = ?, total = ?
     WHERE id = ?`,
    [newQuantity, newSubtotal, newSubtotal, orderItemId]
  );

  // Recalculate order totals
  await calculateOrderTotals(orderItem.order_id);

  console.log('[OrderService] Updated item quantity:', orderItemId, '->', newQuantity);
}

/**
 * Updates the base unit price of an order item (used for weight-based pricing updates)
 */
export async function updateItemUnitPrice(orderItemId: number, newUnitPrice: number): Promise<void> {
  if (newUnitPrice < 0) {
    throw new Error('Unit price cannot be negative');
  }

  const orderItem = await powersync.getOptional<OrderItem>(
    `SELECT * FROM order_items WHERE id = ?`,
    [orderItemId]
  );

  if (!orderItem) {
    throw new Error('Order item not found');
  }

  const quantity = typeof orderItem.quantity === 'string'
    ? parseInt(orderItem.quantity as string, 10)
    : orderItem.quantity;
  const newSubtotal = (newUnitPrice + orderItem.modifier_total) * quantity;

  await powersync.execute(
    `UPDATE order_items
     SET unit_price = ?, subtotal = ?, total = ?
     WHERE id = ?`,
    [newUnitPrice, newSubtotal, newSubtotal, orderItemId]
  );

  await calculateOrderTotals(orderItem.order_id);

  console.log('[OrderService] Updated item unit price:', orderItemId, '->', newUnitPrice);
}

/**
 * Updates the notes for an order item
 */
export async function updateItemNotes(orderItemId: number, notes: string): Promise<void> {
  await powersync.execute(
    `UPDATE order_items SET notes = ? WHERE id = ?`,
    [notes, orderItemId]
  );

  console.log('[OrderService] Updated item notes:', orderItemId);
}

/**
 * Updates modifiers for an order item
 */
export async function updateItemModifiers(
  orderItemId: number,
  modifiers: SelectedModifier[]
): Promise<void> {
  const orderItem = await powersync.getOptional<OrderItem>(
    `SELECT * FROM order_items WHERE id = ?`,
    [orderItemId]
  );

  if (!orderItem) {
    throw new Error('Order item not found');
  }

  await powersync.execute(
    `DELETE FROM order_item_modifiers WHERE order_item_id = ?`,
    [orderItemId]
  );

  for (const modifier of modifiers) {
    const modMaxIdRow = await powersync.getOptional<{ max_id: number }>(
      `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM order_item_modifiers`
    );
    const modId = ((modMaxIdRow?.max_id || 0) + 1).toString();

    await powersync.execute(
      `INSERT INTO order_item_modifiers (
        id, order_item_id, modifier_id, modifier_name, modifier_group_name, extra_price
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        modId,
        orderItemId,
        modifier.modifier_id,
        modifier.modifier_name,
        modifier.modifier_group_name,
        modifier.extra_price,
      ]
    );
  }

  const modifierTotal = modifiers.reduce((sum, mod) => sum + mod.extra_price, 0);
  const itemPrice = orderItem.unit_price + modifierTotal;
  const quantity = typeof orderItem.quantity === 'string'
    ? parseInt(orderItem.quantity as string, 10)
    : orderItem.quantity;
  const newSubtotal = itemPrice * quantity;

  await powersync.execute(
    `UPDATE order_items 
     SET modifier_total = ?, subtotal = ?, total = ?
     WHERE id = ?`,
    [modifierTotal, newSubtotal, newSubtotal, orderItemId]
  );

  await calculateOrderTotals(orderItem.order_id);

  console.log('[OrderService] Updated item modifiers:', orderItemId);
}

/**
 * Calculates and updates order totals (subtotal, tax, service charge, total)
 */
export async function calculateOrderTotals(orderId: number): Promise<void> {
  const now = new Date().toISOString();

  // Get the order
  const order = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId]
  );

  if (!order) {
    throw new Error('Order not found');
  }

  // Get the branch for tax and service charge rates
  const branch = await powersync.getOptional<{ tax_rate: number; service_charge_rate: number }>(
    `SELECT tax_rate, service_charge_rate FROM branches WHERE id = ?`,
    [order.branch_id]
  );

  if (!branch) {
    throw new Error('Branch not found');
  }

  // Calculate subtotal from order items
  const itemsResult = await powersync.getAll<{ total_sum: number }>(
    `SELECT COALESCE(SUM(total), 0) as total_sum 
     FROM order_items 
     WHERE order_id = ? AND is_voided = 0`,
    [orderId]
  );

  const subtotal = itemsResult[0]?.total_sum || 0;

  // Apply discount (if any)
  const discountAmount = order.discount_amount || 0;
  const subtotalAfterDiscount = subtotal - discountAmount;

  // Calculate tax (PPN)
  const taxAmount = subtotalAfterDiscount * (branch.tax_rate / 100);

  // Calculate service charge
  const serviceCharge = subtotalAfterDiscount * (branch.service_charge_rate / 100);

  // Calculate total before rounding
  const totalBeforeRounding = subtotalAfterDiscount + taxAmount + serviceCharge;

  // Round to nearest 100 IDR (Indonesian practice)
  const roundingAmount = Math.round(totalBeforeRounding / 100) * 100 - totalBeforeRounding;
  const total = totalBeforeRounding + roundingAmount;

  // Update order
  await powersync.execute(
    `UPDATE orders 
     SET subtotal = ?, tax_amount = ?, service_charge = ?, rounding_amount = ?, total = ?, updated_at = ?
     WHERE id = ?`,
    [subtotal, taxAmount, serviceCharge, roundingAmount, total, now, orderId]
  );

  console.log('[OrderService] Calculated order totals:', { subtotal, taxAmount, serviceCharge, total });
}

/**
 * Voids an entire order
 */
export async function voidOrder(orderId: number, voidedBy: number, reason: string): Promise<void> {
  const now = new Date().toISOString();

  await powersync.execute(
    `UPDATE orders 
     SET status = ?, voided_by = ?, voided_at = ?, void_reason = ?, updated_at = ?
     WHERE id = ?`,
    [ORDER_STATUS.CANCELLED, voidedBy, now, reason, now, orderId]
  );

  // Get the table ID to update its status
  const order = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId]
  );

  if (order && order.table_id) {
    await powersync.execute(
      `UPDATE tables SET status = ?, updated_at = ? WHERE id = ?`,
      [TABLE_STATUS.AVAILABLE, now, order.table_id]
    );
  }

  console.log('[OrderService] Voided order:', orderId);
}

/**
 * Voids a single order item
 */
export async function voidItem(orderItemId: number, voidedBy: number, reason: string): Promise<void> {
  await powersync.execute(
    `UPDATE order_items 
     SET is_voided = 1, voided_by = ?, void_reason = ?
     WHERE id = ?`,
    [voidedBy, reason, orderItemId]
  );

  // Get the order ID to recalculate totals
  const orderItem = await powersync.getOptional<OrderItem>(
    `SELECT * FROM order_items WHERE id = ?`,
    [orderItemId]
  );

  if (orderItem) {
    await calculateOrderTotals(orderItem.order_id);
  }

  console.log('[OrderService] Voided order item:', orderItemId);
}

/**
 * Gets an order by ID with all its items and modifiers
 */
export async function getOrderWithItems(orderId: number): Promise<{
  order: Order;
  items: (OrderItem & { modifiers: OrderItemModifier[] })[];
} | null> {
  const order = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId]
  );

  if (!order) return null;

  const items = await powersync.getAll<OrderItem>(
    `SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
    [orderId]
  );

  const itemsWithModifiers = await Promise.all(
    items.map(async (item) => {
      const modifiers = await powersync.getAll<OrderItemModifier>(
        `SELECT * FROM order_item_modifiers WHERE order_item_id = ?`,
        [item.id]
      );
      return { ...item, modifiers };
    })
  );

  return { order, items: itemsWithModifiers };
}
