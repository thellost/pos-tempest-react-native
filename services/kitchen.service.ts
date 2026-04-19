import type { KotStatus } from '@/constants/enums';
import { AUDIT_ACTION, KOT_STATUS, ORDER_STATUS } from '@/constants/enums';
import { powersync } from '@/db/provider';
import { addBreadcrumb, startSpan } from '@/lib/sentry';
import { insertAuditLog } from '@/services/audit.service';
import { generateTicketNumber } from '@/utils/order-number';
import { toInt } from '@/utils/coerce';

// ─── Public types ────────────────────────────────────────────────────────────

export interface KOTItemDetail {
  id: number;
  kot_id: number;
  order_item_id: number;
  menu_item_name: string;
  quantity: number;
  unit_of_measure: string;
  weight: number | null;
  notes: string | null;
  /** Modifier names, pre-joined from order_item_modifiers */
  modifier_names: string[];
  status: KotStatus;
}

export interface KOTWithItems {
  id: number;
  order_id: string;
  ticket_number: string;
  status: KotStatus;
  priority: number;
  round_number: number;
  table_number: string | null;
  order_number: string;
  order_type: string;
  customer_name: string | null;
  waiter_name: string | null;
  created_at: string;
  items: KOTItemDetail[];
}

// ─── createKOT ───────────────────────────────────────────────────────────────

/**
 * Creates a Kitchen Order Ticket for the given round of an order.
 * Queries order_items for that round, inserts kot + kot_items,
 * and advances the order status to PREPARING.
 *
 * @param orderId     - DB ID of the parent order
 * @param roundNumber - Which round to generate a KOT for (1, 2, 3 …)
 * @returns The created KOTWithItems (used to show the ticket preview)
 */
export async function createKOT(
  orderId: string,
  roundNumber: number
): Promise<KOTWithItems> {
  return startSpan({ name: 'kitchen.sendKOT', op: 'db.powersync' }, async () => {
  const now = new Date().toISOString();

  // Fetch order + table info for the ticket header
  const orderRow = await powersync.getOptional<{
    order_number: string;
    order_type: string;
    customer_name: string | null;
    table_number: string | null;
    waiter_name: string | null;
  }>(
    `SELECT o.order_number, o.order_type, o.customer_name, t.table_number,
            w.name AS waiter_name
     FROM orders o
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users w ON w.id = o.waiter_id
     WHERE o.id = ?`,
    [orderId]
  );

  if (!orderRow) {
    throw new Error(`[KitchenService] Order ${orderId} not found`);
  }

  // Order items for this round
  const orderItems = await powersync.getAll<{
    id: number | string;
    menu_item_name: string;
    quantity: number | string;
    unit_of_measure: string;
    weight: number | string | null;
    notes: string | null;
  }>(
    `SELECT id, menu_item_name, quantity, unit_of_measure, weight, notes
     FROM order_items
     WHERE order_id = ? AND round_number = ? AND is_voided = 0`,
    [orderId, roundNumber]
  );

  if (orderItems.length === 0) {
    throw new Error(
      `[KitchenService] No items for round ${roundNumber} of order ${orderId}`
    );
  }

  // Generate identifiers
  const ticketNumber = await generateTicketNumber();

  const maxKotRow = await powersync.getOptional<{ max_id: number }>(
    `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM kitchen_order_tickets`
  );
  const kotId = (maxKotRow?.max_id ?? 0) + 1;

  // Insert KOT header
  await powersync.execute(
    `INSERT INTO kitchen_order_tickets
       (id, order_id, ticket_number, status, priority, round_number, printed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      kotId.toString(),
      orderId,
      ticketNumber,
      KOT_STATUS.PENDING,
      1,
      roundNumber,
      now,
      now,
    ]
  );

  // Insert KOT items
  const maxItemRow = await powersync.getOptional<{ max_id: number }>(
    `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM kot_items`
  );
  let itemIdCounter = (maxItemRow?.max_id ?? 0) + 1;

  const itemDetails: KOTItemDetail[] = [];

  for (const oi of orderItems) {
    const orderItemId = toInt(oi.id);

    // Collect modifier names via GROUP_CONCAT
    const modRow = await powersync.getOptional<{ names: string | null }>(
      `SELECT GROUP_CONCAT(modifier_name, ', ') AS names
       FROM order_item_modifiers
       WHERE order_item_id = ?`,
      [orderItemId]
    );

    await powersync.execute(
      `INSERT INTO kot_items (id, kot_id, order_item_id, quantity, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        itemIdCounter.toString(),
        kotId,
        orderItemId,
        oi.quantity,
        KOT_STATUS.PENDING,
        oi.notes,
      ]
    );

    itemDetails.push({
      id: itemIdCounter,
      kot_id: kotId,
      order_item_id: orderItemId,
      menu_item_name: oi.menu_item_name,
      quantity:
        typeof oi.quantity === 'string'
          ? parseFloat(oi.quantity)
          : oi.quantity,
      unit_of_measure: oi.unit_of_measure,
      weight: oi.weight != null ? Number(oi.weight) : null,
      notes: oi.notes,
      modifier_names: modRow?.names
        ? modRow.names.split(', ').filter(Boolean)
        : [],
      status: KOT_STATUS.PENDING,
    });

    itemIdCounter++;
  }

  // Advance order to PREPARING
  await powersync.execute(
    `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`,
    [ORDER_STATUS.PREPARING, now, orderId]
  );

  addBreadcrumb('kitchen', 'KOT sent', { orderId, ticketNumber, roundNumber, itemCount: orderItems.length });
  console.log(
    '[KitchenService] Created KOT:',
    ticketNumber,
    '(round',
    roundNumber,
    ')'
  );

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'kitchen_order_tickets',
    recordId: kotId,
    newValues: { ticket_number: ticketNumber, order_id: orderId, round_number: roundNumber },
    description: `KOT created: ${ticketNumber} for order ${orderId} round ${roundNumber}`,
  });

  return {
    id: kotId,
    order_id: orderId,
    ticket_number: ticketNumber,
    status: KOT_STATUS.PENDING,
    priority: 1,
    round_number: roundNumber,
    table_number: orderRow.table_number,
    order_number: orderRow.order_number,
    order_type: orderRow.order_type,
    customer_name: orderRow.customer_name ?? null,
    waiter_name: orderRow.waiter_name ?? null,
    created_at: now,
    items: itemDetails,
  };
  }); // end kitchen.sendKOT span
}

// ─── updateKOTStatus ──────────────────────────────────────────────────────────

/**
 * Advances a KOT through the lifecycle:
 *   PENDING → IN_PROGRESS → READY → SERVED
 *
 * Uses the correct timestamp column for each transition:
 * - IN_PROGRESS: sets started_at
 * - READY:       sets completed_at, marks all kot_items as READY
 */
export async function updateKOTStatus(
  kotId: number,
  status: KotStatus
): Promise<void> {
  const now = new Date().toISOString();

  if (status === KOT_STATUS.IN_PROGRESS) {
    await powersync.execute(
      `UPDATE kitchen_order_tickets SET status = ?, started_at = ? WHERE id = ?`,
      [status, now, kotId]
    );
  } else if (status === KOT_STATUS.READY) {
    await powersync.execute(
      `UPDATE kitchen_order_tickets SET status = ?, completed_at = ? WHERE id = ?`,
      [status, now, kotId]
    );
    // Mark all items as ready too
    await powersync.execute(
      `UPDATE kot_items SET status = ? WHERE kot_id = ?`,
      [KOT_STATUS.READY, kotId]
    );
  } else {
    await powersync.execute(
      `UPDATE kitchen_order_tickets SET status = ? WHERE id = ?`,
      [status, kotId]
    );
  }

  addBreadcrumb('kitchen', 'KOT status updated', { kotId, status });
  console.log('[KitchenService] KOT', kotId, '->', status);

  if (status === KOT_STATUS.READY || status === KOT_STATUS.SERVED) {
    void insertAuditLog({
      action: AUDIT_ACTION.STATUS_CHANGE,
      tableName: 'kitchen_order_tickets',
      recordId: kotId,
      newValues: { status },
      description: `KOT ${kotId} → ${status}`,
    });
  }
}

// ─── updateKOTItemStatus ─────────────────────────────────────────────────────

/**
 * Updates the status of a single KOT item (e.g. mark one dish as done).
 */
export async function updateKOTItemStatus(
  kotItemId: number,
  status: KotStatus
): Promise<void> {
  await powersync.execute(
    `UPDATE kot_items SET status = ? WHERE id = ?`,
    [status, kotItemId]
  );
}

// ─── getKOTsForOrder ──────────────────────────────────────────────────────────

/**
 * Returns all KOTs for a given order, ordered by round number.
 * Used for the order history / print-again flow.
 */
export async function getKOTsForOrder(
  orderId: string
): Promise<KOTWithItems[]> {
  const rows = await powersync.getAll<{
    id: number | string;
    ticket_number: string;
    status: string;
    priority: number | string;
    round_number: number | string;
    created_at: string;
    table_number: string | null;
    order_number: string;
    order_type: string;
    customer_name: string | null;
    waiter_name: string | null;
  }>(
    `SELECT kot.id, kot.ticket_number, kot.status, kot.priority,
            kot.round_number, kot.created_at, t.table_number,
            o.order_number, o.order_type, o.customer_name,
            w.name AS waiter_name
     FROM kitchen_order_tickets kot
     JOIN orders o ON o.id = kot.order_id
     LEFT JOIN tables t ON t.id = o.table_id
     LEFT JOIN users w ON w.id = o.waiter_id
     WHERE kot.order_id = ?
     ORDER BY kot.round_number ASC`,
    [orderId]
  );

  return Promise.all(
    rows.map(async (row) => {
      const kotId = toInt(row.id);
      return {
        id: kotId,
        order_id: orderId,
        ticket_number: row.ticket_number,
        status: row.status as KotStatus,
        priority: toInt(row.priority ?? 1),
        round_number: toInt(row.round_number ?? 1),
        table_number: row.table_number,
        order_number: row.order_number,
        order_type: row.order_type,
        customer_name: row.customer_name ?? null,
        waiter_name: row.waiter_name ?? null,
        created_at: row.created_at,
        items: await _getKOTItems(kotId),
      };
    })
  );
}

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Fetches KOT items with modifier names (GROUP_CONCAT) for a given kot_id.
 */
async function _getKOTItems(kotId: number): Promise<KOTItemDetail[]> {
  const rows = await powersync.getAll<{
    id: number | string;
    order_item_id: number | string;
    menu_item_name: string;
    quantity: number | string;
    unit_of_measure: string;
    weight: number | string | null;
    notes: string | null;
    status: string;
    modifier_names: string | null;
  }>(
    `SELECT ki.id, ki.order_item_id, oi.menu_item_name,
            oi.quantity, oi.unit_of_measure, oi.weight, ki.notes, ki.status,
            GROUP_CONCAT(oim.modifier_name, ', ') AS modifier_names
     FROM kot_items ki
     JOIN order_items oi ON oi.id = ki.order_item_id
     LEFT JOIN order_item_modifiers oim ON oim.order_item_id = ki.order_item_id
     WHERE ki.kot_id = ?
     GROUP BY ki.id`,
    [kotId]
  );

  return rows.map((row) => ({
    id: toInt(row.id),
    kot_id: kotId,
    order_item_id: toInt(row.order_item_id),
    menu_item_name: row.menu_item_name,
    quantity:
      typeof row.quantity === 'string'
        ? parseFloat(row.quantity)
        : row.quantity,
    unit_of_measure: row.unit_of_measure,
    weight: row.weight != null ? Number(row.weight) : null,
    notes: row.notes,
    modifier_names: row.modifier_names
      ? row.modifier_names.split(', ').filter(Boolean)
      : [],
    status: row.status as KotStatus,
  }));
}
