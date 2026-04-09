import { toIntOrNull } from '@/utils/coerce';
import { powersync } from './provider';

/**
 * Pre-built queries for each allowed table.
 * Avoids any runtime string interpolation into SQL — the query is fully
 * determined at module load time from compile-time literals.
 */
const AUTO_ID_QUERIES: Record<string, string> = {
  customers:               'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM customers',
  inventory_movements:     'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM inventory_movements',
  kitchen_order_tickets:   'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM kitchen_order_tickets',
  kot_items:               'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM kot_items',
  order_discounts:         'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM order_discounts',
  order_item_modifiers:    'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM order_item_modifiers',
  order_items:             'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM order_items',
  payments:                'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM payments',
  shift_cash_transactions: 'SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM shift_cash_transactions',
};

/**
 * Returns the next safe auto-increment integer ID for a given table.
 *
 * All offline-first tables in this app use plain integer primary keys instead
 * of UUIDs so that they can be referenced via foreign keys in SQLite.
 * MAX + 1 is safe here because PowerSync tables are local-only for inserts.
 *
 * Math.max(..., 0) guards against negative IDs that may exist from legacy
 * local-first inserts made before the current schema was finalised.
 *
 * Only tables listed in `AUTO_ID_QUERIES` are accepted — all queries are
 * pre-built as string literals, so no runtime SQL interpolation occurs.
 *
 * @param tableName - Must be a key of AUTO_ID_QUERIES
 * @returns Next usable integer ID as a number
 */
export async function getNextAutoId(tableName: keyof typeof AUTO_ID_QUERIES): Promise<number> {
  const query = AUTO_ID_QUERIES[tableName];
  if (!query) {
    throw new Error(`[db/utils] getNextAutoId: table '${tableName}' is not allowed`);
  }
  const row = await powersync.getOptional<{ max_id: number | string | null }>(query);
  return Math.max(toIntOrNull(row?.max_id) ?? 0, 0) + 1;
}
