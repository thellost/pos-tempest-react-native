import * as Crypto from 'expo-crypto';

import { MOVEMENT_TYPE } from '@/constants/enums';
import { hasPermission, PERMISSION } from '@/constants/permissions';
import type { OrderItem } from '@/db/models';
import { powersync } from '@/db/provider';
import { addBreadcrumb, captureError } from '@/lib/sentry';

interface OrderItemForDeduction {
  menu_item_id: number;
  quantity: number;
  weight: number | null;
}

interface IngredientRow {
  inventory_id: number;
  quantity_needed: number;
}

interface InventoryRow {
  id: number;
  stock_quantity: number;
}

interface OrderInventoryLedgerRow {
  inventory_id: number;
  net_quantity_change: number;
}

/**
 * Applies inventory stock changes for quantity edits on already-confirmed order items.
 * Positive deltas deduct stock; negative deltas restock the reduced quantity.
 * Skips menu items with no configured ingredients.
 * @param orderItem - The confirmed order item being adjusted
 * @param quantityDelta - Added item quantity if positive, reduced item quantity if negative
 * @param userId - The user responsible for the adjustment
 * @param reason - Human-readable reason to store in inventory movement history
 */
export async function adjustStockForConfirmedOrderItem(
  orderItem: OrderItem,
  quantityDelta: number,
  userId: number,
  reason: string
): Promise<void> {
  if (!Number.isFinite(quantityDelta)) {
    throw new Error('[InventoryService] Quantity delta must be a finite number');
  }

  if (quantityDelta === 0) {
    addBreadcrumb('inventory', 'No stock adjustment needed for confirmed order item', {
      orderId: orderItem.order_id,
      orderItemId: orderItem.id,
    });
    return;
  }

  try {
    const now = new Date().toISOString();
    const ingredients = await powersync.getAll<IngredientRow>(
      `SELECT inventory_id, quantity_needed FROM menu_item_ingredients WHERE menu_item_id = ?`,
      [orderItem.menu_item_id]
    );

    if (ingredients.length === 0) {
      addBreadcrumb('inventory', 'No ingredients configured for confirmed order item adjustment', {
        orderId: orderItem.order_id,
        orderItemId: orderItem.id,
        menuItemId: orderItem.menu_item_id,
      });
      return;
    }

    const inventoryById = new Map<number, InventoryRow>();

    for (const ingredient of ingredients) {
      if (inventoryById.has(ingredient.inventory_id)) continue;

      const inventory = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ingredient.inventory_id]
      );

      if (!inventory) {
        throw new Error(
          `[InventoryService] Inventory item not found for confirmed order item adjustment: ${ingredient.inventory_id}`
        );
      }

      inventoryById.set(ingredient.inventory_id, inventory);
    }

    const adjustmentDirection = quantityDelta > 0 ? 'deducted' : 'restocked';
    const signedDelta = quantityDelta > 0 ? `+${quantityDelta}` : String(quantityDelta);
    const baseReason = reason.trim() || 'Confirmed order item quantity adjustment';
    const movementReason = `${baseReason} (${adjustmentDirection} stock for ${orderItem.menu_item_name}, order item ${orderItem.id}, quantity delta ${signedDelta})`;
    let movementCount = 0;

    const weightMultiplier = orderItem.weight ?? 1;

    for (const ingredient of ingredients) {
      const quantityChange = -quantityDelta * weightMultiplier * ingredient.quantity_needed;
      if (quantityChange === 0) continue;

      const inventory = inventoryById.get(ingredient.inventory_id);
      if (!inventory) {
        throw new Error(
          `[InventoryService] Inventory item not loaded for confirmed order item adjustment: ${ingredient.inventory_id}`
        );
      }

      const quantityBefore = inventory.stock_quantity;

      // Relative UPDATE: immune to sync overwrites between SELECT and UPDATE
      await powersync.execute(
        `UPDATE inventories SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?`,
        [quantityChange, now, ingredient.inventory_id]
      );

      const afterSnap = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ingredient.inventory_id]
      );

      const quantityAfter = afterSnap?.stock_quantity ?? (quantityBefore + quantityChange);

      const newId = Crypto.randomUUID();

      await powersync.execute(
        `INSERT INTO inventory_movements (
          id, inventory_id, user_id, movement_type, quantity_change,
          quantity_before, quantity_after, reference_type, reference_id, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          ingredient.inventory_id,
          userId,
          MOVEMENT_TYPE.ORDER_ADJUSTMENT,
          quantityChange,
          quantityBefore,
          quantityAfter,
          'order',
          orderItem.order_id,
          movementReason,
          now,
        ]
      );

      inventoryById.set(ingredient.inventory_id, {
        ...inventory,
        stock_quantity: quantityAfter,
      });
      movementCount += 1;
    }

    addBreadcrumb('inventory', 'Stock adjusted for confirmed order item', {
      orderId: orderItem.order_id,
      orderItemId: orderItem.id,
      quantityDelta,
      movementCount,
    });
    console.log('[InventoryService] Stock adjusted for confirmed order item:', orderItem.id);
  } catch (error) {
    captureError(error, {
      module: 'inventory',
      operation: 'adjustStockForConfirmedOrderItem',
      level: 'error',
      extras: {
        orderId: orderItem.order_id,
        orderItemId: orderItem.id,
        quantityDelta,
      },
    });
    throw error;
  }
}

/**
 * Deducts inventory stock for a list of order items based on menu_item_ingredients.
 * Creates inventory_movements records for audit trail.
 * Skips silently if a menu item has no ingredients configured.
 */
export async function deductStockForItems(
  items: OrderItemForDeduction[],
  userId: number,
  orderId: string
): Promise<void> {
  try {
  const now = new Date().toISOString();

  for (const item of items) {
    // Get ingredients for this menu item
    const ingredients = await powersync.getAll<IngredientRow>(
      `SELECT inventory_id, quantity_needed FROM menu_item_ingredients WHERE menu_item_id = ?`,
      [item.menu_item_id]
    );

    if (ingredients.length === 0) continue;

    for (const ingredient of ingredients) {
      const effectiveMultiplier = item.quantity * (item.weight ?? 1);
      const totalDeduction = effectiveMultiplier * ingredient.quantity_needed;

      // Read stock before relative update — immune to sync overwrites
      const beforeSnap = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ingredient.inventory_id]
      );

      if (!beforeSnap) continue;

      const quantityBefore = beforeSnap.stock_quantity;

      // Relative UPDATE: even if PowerSync changed stock between SELECT and UPDATE,
      // the delta is applied correctly to whatever the current value is
      await powersync.execute(
        `UPDATE inventories SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?`,
        [totalDeduction, now, ingredient.inventory_id]
      );

      // Read actual stock after relative update for the movement record
      const afterSnap = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ingredient.inventory_id]
      );

      const quantityAfter = afterSnap?.stock_quantity ?? (quantityBefore - totalDeduction);

      const newId = Crypto.randomUUID();

      // Create movement record
      await powersync.execute(
        `INSERT INTO inventory_movements (
          id, inventory_id, user_id, movement_type, quantity_change,
          quantity_before, quantity_after, reference_type, reference_id, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          ingredient.inventory_id,
          userId,
          MOVEMENT_TYPE.ORDER_DEDUCTION,
          -totalDeduction,
          quantityBefore,
          quantityAfter,
          'order',
          orderId,
          'Auto-deduction on order confirmation',
          now,
        ]
      );
    }
  }

  addBreadcrumb('inventory', 'Stock deducted for order', { orderId, itemCount: items.length });
  console.log('[InventoryService] Stock deducted for order:', orderId);
  } catch (error) {
    captureError(error, { module: 'inventory', operation: 'deductStockForItems', level: 'error', extras: { orderId } });
    throw error;
  }
}

/**
 * Restocks inventory for a cancelled order by reversing the remaining net stock
 * deduction recorded in the order movement ledger. Order deductions and
 * confirmed item adjustments are aggregated per inventory item so previously
 * restocked item edits are not restocked again. Idempotent: if any
 * order_cancellation movement already exists for the order, calling this again
 * is a no-op.
 */
export async function restockForCancelledOrder(
  orderId: string,
  userId: number
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const deductionCount = await powersync.getAll<{ count: number }>(
      `SELECT COUNT(*) as count
         FROM inventory_movements
        WHERE reference_type = 'order'
          AND reference_id = ?
          AND movement_type = ?`,
      [orderId, MOVEMENT_TYPE.ORDER_DEDUCTION]
    );

    if ((deductionCount[0]?.count ?? 0) === 0) {
      addBreadcrumb('inventory', 'No deductions to restock for cancelled order', { orderId });
      return;
    }

    const existingRestocks = await powersync.getAll<{ count: number }>(
      `SELECT COUNT(*) as count
         FROM inventory_movements
        WHERE reference_type = 'order'
          AND reference_id = ?
          AND movement_type = ?`,
      [orderId, MOVEMENT_TYPE.ORDER_CANCELLATION]
    );

    if ((existingRestocks[0]?.count ?? 0) > 0) {
      addBreadcrumb('inventory', 'Restock already applied for cancelled order', { orderId });
      return;
    }

    const remainingDeductions = await powersync.getAll<OrderInventoryLedgerRow>(
      `SELECT inventory_id, SUM(quantity_change) as net_quantity_change
         FROM inventory_movements
        WHERE reference_type = 'order'
          AND reference_id = ?
          AND movement_type IN (?, ?)
        GROUP BY inventory_id
       HAVING SUM(quantity_change) < 0`,
      [orderId, MOVEMENT_TYPE.ORDER_DEDUCTION, MOVEMENT_TYPE.ORDER_ADJUSTMENT]
    );

    if (remainingDeductions.length === 0) {
      addBreadcrumb('inventory', 'No net deductions to restock for cancelled order', { orderId });
      return;
    }

    let movementCount = 0;

    for (const ledgerRow of remainingDeductions) {
      const restockAmount = -Number(ledgerRow.net_quantity_change);
      if (!Number.isFinite(restockAmount) || restockAmount <= 0) continue;

      const beforeSnap = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ledgerRow.inventory_id]
      );

      if (!beforeSnap) continue;

      const quantityBefore = beforeSnap.stock_quantity;

      // Relative UPDATE: immune to sync overwrites between SELECT and UPDATE
      await powersync.execute(
        `UPDATE inventories SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?`,
        [restockAmount, now, ledgerRow.inventory_id]
      );

      const afterSnap = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ledgerRow.inventory_id]
      );

      const quantityAfter = afterSnap?.stock_quantity ?? (quantityBefore + restockAmount);

      const newId = Crypto.randomUUID();

      await powersync.execute(
        `INSERT INTO inventory_movements (
          id, inventory_id, user_id, movement_type, quantity_change,
          quantity_before, quantity_after, reference_type, reference_id, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          ledgerRow.inventory_id,
          userId,
          MOVEMENT_TYPE.ORDER_CANCELLATION,
          restockAmount,
          quantityBefore,
          quantityAfter,
          'order',
          orderId,
          'Auto-restock on order cancellation',
          now,
        ]
      );

      movementCount += 1;
    }

    addBreadcrumb('inventory', 'Stock restocked for cancelled order', {
      orderId,
      movementCount,
    });
    console.log('[InventoryService] Stock restocked for cancelled order:', orderId);
  } catch (error) {
    captureError(error, {
      module: 'inventory',
      operation: 'restockForCancelledOrder',
      level: 'error',
      extras: { orderId },
    });
    throw error;
  }
}

/**
 * Manually adjusts stock for an inventory item.
 * Requires the caller to have the `adjust_stock` permission.
 * @param inventoryId - The inventory item ID to adjust
 * @param quantityChange - Positive to add stock, negative to remove stock
 * @param reason - Human-readable reason for the adjustment
 * @param userId - The ID of the user performing the adjustment
 * @param callerRole - The role of the caller, used for permission check
 */
export async function adjustStock(
  inventoryId: number,
  quantityChange: number,
  reason: string,
  userId: number,
  callerRole: string
): Promise<void> {
  if (!hasPermission(callerRole, PERMISSION.ADJUST_STOCK)) {
    throw new Error('[InventoryService] Permission denied: adjust_stock required');
  }

  try {
    const now = new Date().toISOString();

    const inventory = await powersync.getOptional<InventoryRow>(
      `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
      [inventoryId]
    );

    if (!inventory) {
      throw new Error(`[InventoryService] Inventory item not found: ${inventoryId}`);
    }

    const quantityBefore = inventory.stock_quantity;

    // Relative UPDATE: immune to sync overwrites between SELECT and UPDATE
    await powersync.execute(
      `UPDATE inventories SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?`,
      [quantityChange, now, inventoryId]
    );

    const afterSnap = await powersync.getOptional<InventoryRow>(
      `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
      [inventoryId]
    );

    const quantityAfter = afterSnap?.stock_quantity ?? (quantityBefore + quantityChange);

    const newId = Crypto.randomUUID();

    await powersync.execute(
      `INSERT INTO inventory_movements (
        id, inventory_id, user_id, movement_type, quantity_change,
        quantity_before, quantity_after, reference_type, reference_id, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        inventoryId,
        userId,
        MOVEMENT_TYPE.MANUAL_ADJUSTMENT,
        quantityChange,
        quantityBefore,
        quantityAfter,
        'manual',
        null,
        reason,
        now,
      ]
    );

    addBreadcrumb('inventory', 'Manual stock adjustment', { inventoryId, quantityChange, userId });
    console.log('[InventoryService] Manual stock adjusted for inventory:', inventoryId);
  } catch (error) {
    captureError(error, { module: 'inventory', operation: 'adjustStock', level: 'error', extras: { inventoryId } });
    throw error;
  }
}
