import { MOVEMENT_TYPE } from '@/constants/enums';
import { hasPermission, PERMISSION } from '@/constants/permissions';
import { powersync } from '@/db/provider';
import { addBreadcrumb, captureError } from '@/lib/sentry';

interface OrderItemForDeduction {
  menu_item_id: number;
  quantity: number;
}

interface IngredientRow {
  inventory_id: number;
  quantity_needed: number;
}

interface InventoryRow {
  id: number;
  stock_quantity: number;
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
      const totalDeduction = item.quantity * ingredient.quantity_needed;

      // Get current stock
      const inventory = await powersync.getOptional<InventoryRow>(
        `SELECT id, stock_quantity FROM inventories WHERE id = ?`,
        [ingredient.inventory_id]
      );

      if (!inventory) continue;

      const quantityBefore = inventory.stock_quantity;
      const quantityAfter = quantityBefore - totalDeduction;

      // Update stock
      await powersync.execute(
        `UPDATE inventories SET stock_quantity = ?, updated_at = ? WHERE id = ?`,
        [quantityAfter, now, ingredient.inventory_id]
      );

      // Get next movement ID
      const maxIdRow = await powersync.getOptional<{ max_id: number }>(
        `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM inventory_movements`
      );
      const newId = ((maxIdRow?.max_id || 0) + 1).toString();

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
    const quantityAfter = quantityBefore + quantityChange;

    await powersync.execute(
      `UPDATE inventories SET stock_quantity = ?, updated_at = ? WHERE id = ?`,
      [quantityAfter, now, inventoryId]
    );

    const maxIdRow = await powersync.getOptional<{ max_id: number }>(
      `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM inventory_movements`
    );
    const newId = ((maxIdRow?.max_id || 0) + 1).toString();

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
