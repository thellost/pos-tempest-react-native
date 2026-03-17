import { AUDIT_ACTION, ORDER_STATUS, PAYMENT_STATUS, TABLE_STATUS } from '@/constants/enums';
import type { MenuItem, Order, OrderItem, OrderItemModifier } from '@/db/models';
import { powersync } from '@/db/provider';
import { insertAuditLog } from '@/services/audit.service';
import { deductStockForItems } from '@/services/inventory.service';
import { generateOrderNumber } from '@/utils/order-number';
import { toInt } from '@/utils/coerce';

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
 * Breakdown of calculated order totals.
 * Returned by `getOrderTotals()` and used by the UI for display.
 */
export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;
  roundingAmount: number;
  total: number;
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

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'orders',
    recordId: toInt(order.id),
    userId: cashierId,
    branchId: branchId,
    newValues: { order_number: orderNumber, order_type: orderType, table_id: tableId, shift_id: shiftId },
    description: `Order created: ${orderNumber}`,
  });

  console.log('[OrderService] Created order:', orderNumber);
  return order;
}

/**
 * Confirms an order (moves from pending to confirmed)
 */
export async function confirmOrder(orderId: number, cashierId: number): Promise<void> {
  const now = new Date().toISOString();

  await powersync.execute(
    `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`,
    [ORDER_STATUS.CONFIRMED, now, orderId]
  );

  // Deduct inventory stock based on menu_item_ingredients
  const orderItems = await powersync.getAll<{ menu_item_id: number; quantity: number }>(
    `SELECT menu_item_id, quantity FROM order_items WHERE order_id = ? AND is_voided = 0`,
    [orderId]
  );
  if (orderItems.length > 0) {
    await deductStockForItems(orderItems, cashierId, orderId);
  }

  void insertAuditLog({
    action: AUDIT_ACTION.STATUS_CHANGE,
    tableName: 'orders',
    recordId: orderId,
    newValues: { status: ORDER_STATUS.CONFIRMED },
    description: `Order confirmed: ${orderId}`,
  });

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
  weight: number | null = null,
  roundNumber: number = 1
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
  // Also only merge if same round number
  if (modifiers.length === 0 && normalizedNotes.length === 0) {
    const existingItem = await powersync.getOptional<OrderItem>(
      `SELECT * FROM order_items
       WHERE order_id = ?
         AND menu_item_id = ?
         AND is_voided = 0
         AND COALESCE(notes, '') = ''
         AND modifier_total = 0
         AND unit_price = ?
         AND round_number = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId, menuItem.id, unitPrice, roundNumber]
    );

    if (existingItem) {
      await updateItemQuantity(toInt(existingItem.id), toInt(existingItem.quantity) + quantity);

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
      is_voided, round_number, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      roundNumber,
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

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'order_items',
    recordId: parseInt(newId, 10),
    newValues: {
      order_id: orderId,
      menu_item_name: menuItem.name,
      quantity,
      unit_price: unitPrice,
      round_number: roundNumber,
    },
    description: `Item added: ${menuItem.name} x${quantity} to order ${orderId}`,
  });

  console.log('[OrderService] Added item to order:', menuItem.name, 'x', quantity, 'round:', roundNumber);
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

  void insertAuditLog({
    action: AUDIT_ACTION.DELETE,
    tableName: 'order_items',
    recordId: orderItemId,
    oldValues: {
      order_id: orderItem.order_id,
      menu_item_name: orderItem.menu_item_name,
      quantity: orderItem.quantity,
    },
    description: `Item removed: ${orderItem.menu_item_name} from order ${orderItem.order_id}`,
  });

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

  const newSubtotal = (newUnitPrice + orderItem.modifier_total) * toInt(orderItem.quantity);

  await powersync.execute(
    `UPDATE order_items
     SET unit_price = ?, subtotal = ?, total = ?
     WHERE id = ?`,
    [newUnitPrice, newSubtotal, newSubtotal, orderItemId]
  );

  await calculateOrderTotals(orderItem.order_id);

  void insertAuditLog({
    action: AUDIT_ACTION.UPDATE,
    tableName: 'order_items',
    recordId: orderItemId,
    oldValues: { unit_price: orderItem.unit_price },
    newValues: { unit_price: newUnitPrice },
    description: `Item price updated: ${orderItem.menu_item_name} → ${newUnitPrice}`,
  });

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
  const newSubtotal = itemPrice * toInt(orderItem.quantity);

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

  const existingOrder = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId]
  );

  if (!existingOrder) {
    throw new Error('Order not found');
  }

  await powersync.execute(
    `UPDATE orders 
     SET status = ?, voided_by = ?, voided_at = ?, void_reason = ?, updated_at = ?
     WHERE id = ?`,
    [ORDER_STATUS.CANCELLED, voidedBy, now, reason, now, orderId]
  );

  const updatedOrder = await powersync.getOptional<Order>(
    `SELECT * FROM orders WHERE id = ?`,
    [orderId]
  );

  const normalizedOrderId = toInt(existingOrder.id);

  void insertAuditLog({
    action: AUDIT_ACTION.VOID,
    tableName: 'orders',
    recordId: Number.isNaN(normalizedOrderId) ? null : normalizedOrderId,
    userId: voidedBy,
    oldValues: {
      status: existingOrder.status,
      voided_by: existingOrder.voided_by,
      voided_at: existingOrder.voided_at,
      void_reason: existingOrder.void_reason,
    },
    newValues: {
      status: updatedOrder?.status ?? ORDER_STATUS.CANCELLED,
      voided_by: voidedBy,
      voided_at: now,
      void_reason: reason,
    },
    description: `Order voided: ${existingOrder.order_number || orderId}`,
  });

  if (existingOrder.table_id) {
    await powersync.execute(
      `UPDATE tables SET status = ?, updated_at = ? WHERE id = ?`,
      [TABLE_STATUS.AVAILABLE, now, existingOrder.table_id]
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

  void insertAuditLog({
    action: AUDIT_ACTION.VOID,
    tableName: 'order_items',
    recordId: orderItemId,
    userId: voidedBy,
    newValues: { reason, voided_by: voidedBy },
    description: `Order item voided: ${orderItemId}`,
  });

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

/**
 * Returns the currently stored order totals for a given order.
 * This is a read-only function — it does NOT recalculate.
 * Call `calculateOrderTotals(orderId)` first if you need fresh values.
 *
 * @param orderId - The order ID
 * @returns OrderTotals object or null if the order does not exist
 */
export async function getOrderTotals(orderId: number): Promise<OrderTotals | null> {
  const order = await powersync.getOptional<Order>(
    `SELECT subtotal, discount_amount, tax_amount, service_charge, rounding_amount, total
     FROM orders WHERE id = ?`,
    [orderId]
  );

  if (!order) {
    console.error('[OrderService] getOrderTotals: order not found:', orderId);
    return null;
  }

  return {
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    serviceCharge: order.service_charge,
    roundingAmount: order.rounding_amount,
    total: order.total,
  };
}

/**
 * Returns all active (non-terminal) orders for a given table.
 * Active means status is NOT completed, cancelled, or served.
 *
 * @param tableId - The table ID
 * @returns Array of active orders (usually 0 or 1)
 */
export async function getActiveOrdersForTable(tableId: number): Promise<Order[]> {
  try {
    const orders = await powersync.getAll<Order>(
      `SELECT * FROM orders
       WHERE table_id = ?
         AND status NOT IN (?, ?, ?)
       ORDER BY created_at DESC`,
      [tableId, ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.SERVED]
    );

    return orders;
  } catch (error) {
    console.error('[OrderService] getActiveOrdersForTable error:', error);
    throw new Error('Failed to fetch active orders for table');
  }
}

/**
 * Gets the current round number for an order.
 * Returns max(round_number) from order_items + 1, or 1 if no items.
 *
 * @param orderId - The order ID
 * @returns The next round number to use
 */
export async function getCurrentRound(orderId: number): Promise<number> {
  const result = await powersync.getOptional<{ max_round: number }>(
    `SELECT MAX(round_number) as max_round FROM order_items WHERE order_id = ?`,
    [orderId]
  );

  return (result?.max_round || 0) + 1;
}

/**
 * Gets items grouped by round number.
 *
 * @param orderId - The order ID
 * @returns Map of round number to items
 */
export async function getOrderItemsByRound(orderId: number): Promise<Map<number, (OrderItem & { modifiers: OrderItemModifier[] })[]>> {
  const items = await powersync.getAll<OrderItem>(
    `SELECT * FROM order_items WHERE order_id = ? AND is_voided = 0 ORDER BY round_number ASC, created_at ASC`,
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

  const roundMap = new Map<number, (OrderItem & { modifiers: OrderItemModifier[] })[]>();
  for (const item of itemsWithModifiers) {
    const round = item.round_number || 1;
    if (!roundMap.has(round)) {
      roundMap.set(round, []);
    }
    roundMap.get(round)!.push(item);
  }

  return roundMap;
}

/**
 * Assigns (or clears) a customer on an existing order.
 *
 * @param orderId - The order ID
 * @param customerId - Customer ID to assign, or null to clear
 */
export async function assignCustomerToOrder(
  orderId: number,
  customerId: number | null
): Promise<void> {
  const now = new Date().toISOString();
  await powersync.execute(
    `UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ?`,
    [customerId, now, orderId]
  );
}

/**
 * Gets the sent timestamp for each round from kitchen_order_tickets.
 *
 * @param orderId - The order ID
 * @returns Map of round number to sent timestamp
 */
export async function getRoundSentTimestamps(orderId: number): Promise<Map<number, string>> {
  const tickets = await powersync.getAll<{ round_number: number; printed_at: string }>(
    `SELECT round_number, MIN(printed_at) AS printed_at FROM kitchen_order_tickets WHERE order_id = ? GROUP BY round_number`,
    [orderId]
  );

  const sentMap = new Map<number, string>();
  for (const ticket of tickets) {
    if (ticket.round_number && ticket.printed_at) {
      sentMap.set(ticket.round_number, ticket.printed_at);
    }
  }

  return sentMap;
}
