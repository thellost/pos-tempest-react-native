import { ORDER_TYPE } from '@/constants/enums';
import { powersync } from '@/db/provider';

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface BillLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  modifiers: string[];
  notes: string | null;
}

export interface PaymentLine {
  method: string;
  amount: number;
  changeAmount: number;
}

export interface BillData {
  // Branch header
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;

  // Order info
  orderNumber: string;
  orderType: string;
  tableLabel: string;
  cashierName: string;
  printedAt: string;

  // Items
  items: BillLineItem[];

  // Totals
  subtotal: number;
  discountAmount: number;
  discountName: string | null;
  taxAmount: number;
  serviceCharge: number;
  roundingAmount: number;
  total: number;

  // Payments — populated when includePayments=true (receipt), empty for bill
  payments: PaymentLine[];
}

// ── Internal row types ────────────────────────────────────────────────────────

type OrderBillRow = {
  order_number: string;
  order_type: string;
  table_number: string | null;
  cashier_name: string | null;
  branch_name: string | null;
  branch_address: string | null;
  branch_phone: string | null;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  service_charge: number | string | null;
  rounding_amount: number | string | null;
  total: number | string | null;
  created_at: string;
};

type ItemBillRow = {
  id: number | string;
  menu_item_name: string;
  quantity: number | string;
  unit_price: number | string;
  modifier_total: number | string;
  total: number | string;
  notes: string | null;
};

type PaymentBillRow = {
  payment_method: string;
  amount: number | string | null;
  change_amount: number | string | null;
};

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Fetches all data needed to render a bill or receipt for the given order.
 *
 * @param orderId - The numeric order ID
 * @param includePayments - Pass true for a receipt (post-payment); false for a
 *   pre-payment bill
 */
export async function getBillData(
  orderId: number,
  includePayments = false,
): Promise<BillData> {
  const orderRow = await powersync.getOptional<OrderBillRow>(
    `SELECT
       o.order_number, o.order_type,
       o.subtotal, o.discount_amount, o.tax_amount,
       o.service_charge, o.rounding_amount, o.total,
       o.created_at,
       t.table_number,
       u.name AS cashier_name,
       b.name AS branch_name,
       b.address AS branch_address,
       b.phone AS branch_phone
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     LEFT JOIN users u ON o.cashier_id = u.id
     LEFT JOIN branches b ON o.branch_id = b.id
     WHERE o.id = ?`,
    [orderId],
  );

  if (!orderRow) {
    throw new Error(`[ReceiptService] Order ${orderId} not found`);
  }

  // Load items
  const itemRows = await powersync.getAll<ItemBillRow>(
    `SELECT id, menu_item_name, quantity, unit_price, modifier_total, total, notes
     FROM order_items
     WHERE order_id = ? AND is_voided = 0
     ORDER BY round_number ASC, id ASC`,
    [orderId],
  );

  const items: BillLineItem[] = [];
  for (const row of itemRows) {
    const itemId =
      typeof row.id === 'string' ? parseInt(row.id, 10) : row.id;
    const modRows = await powersync.getAll<{ modifier_name: string }>(
      `SELECT modifier_name FROM order_item_modifiers WHERE order_item_id = ?`,
      [itemId],
    );
    items.push({
      name: row.menu_item_name,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      total: Number(row.total),
      modifiers: modRows.map((m) => m.modifier_name),
      notes: row.notes,
    });
  }

  // Optionally load payments
  let payments: PaymentLine[] = [];
  if (includePayments) {
    const payRows = await powersync.getAll<PaymentBillRow>(
      `SELECT payment_method, amount, change_amount
       FROM payments
       WHERE order_id = ?
       ORDER BY paid_at ASC`,
      [orderId],
    );
    payments = payRows.map((p) => ({
      method: p.payment_method,
      amount: Number(p.amount) || 0,
      changeAmount: Number(p.change_amount) || 0,
    }));
  }

  const isTakeaway = orderRow.order_type === ORDER_TYPE.TAKEAWAY;
  const tableLabel = isTakeaway
    ? 'Takeaway 🛍️'
    : orderRow.table_number
      ? `Table ${orderRow.table_number}`
      : 'N/A';

  return {
    branchName: orderRow.branch_name || 'POS Tempest',
    branchAddress: orderRow.branch_address,
    branchPhone: orderRow.branch_phone,
    orderNumber: orderRow.order_number,
    orderType: orderRow.order_type,
    tableLabel,
    cashierName: orderRow.cashier_name || 'Staff',
    printedAt: new Date().toISOString(),
    items,
    subtotal: Number(orderRow.subtotal) || 0,
    discountAmount: Number(orderRow.discount_amount) || 0,
    discountName: null,
    taxAmount: Number(orderRow.tax_amount) || 0,
    serviceCharge: Number(orderRow.service_charge) || 0,
    roundingAmount: Number(orderRow.rounding_amount) || 0,
    total: Number(orderRow.total) || 0,
    payments,
  };
}
