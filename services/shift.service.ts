import type { CashTransactionReason, CashTransactionType } from '@/constants/enums';
import { AUDIT_ACTION, CASH_TRANSACTION_TYPE, SHIFT_STATUS } from '@/constants/enums';
import { powersync } from '@/db/provider';
import { addBreadcrumb } from '@/lib/sentry';
import { insertAuditLog } from '@/services/audit.service';

export type ShiftRecord = {
  id: number;
  user_id: number;
  branch_id: number;
  device_id: number | null;
  status: string;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

type ShiftRow = {
  id: number | string;
  user_id: number | string;
  branch_id: number | string;
  device_id: number | string | null;
  status: string;
  opening_cash: number | string | null;
  closing_cash: number | string | null;
  expected_cash: number | string | null;
  cash_difference: number | string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

type CashSummaryRow = {
  cash_received: number | string | null;
  change_given: number | string | null;
};

type CashTxSummaryRow = {
  total_cash_in: number | string | null;
  total_cash_out: number | string | null;
};

type MaxIdRow = {
  max_id: number | string | null;
};

export type ShiftCashTransactionRecord = {
  id: number;
  shift_id: number;
  user_id: number;
  type: CashTransactionType;
  reason: CashTransactionReason;
  amount: number;
  note: string | null;
  created_at: string;
  user_name?: string;
};

export type ShiftCashSummary = {
  cashReceived: number;
  changeGiven: number;
  netCashSales: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShift(row: ShiftRow): ShiftRecord {
  return {
    id: toNumber(row.id),
    user_id: toNumber(row.user_id),
    branch_id: toNumber(row.branch_id),
    device_id: row.device_id !== null && row.device_id !== undefined ? toNumber(row.device_id) : null,
    status: row.status,
    opening_cash: toNumber(row.opening_cash),
    closing_cash: row.closing_cash === null ? null : toNumber(row.closing_cash),
    expected_cash: row.expected_cash === null ? null : toNumber(row.expected_cash),
    cash_difference: row.cash_difference === null ? null : toNumber(row.cash_difference),
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    notes: row.notes,
  };
}

async function getShiftById(shiftId: number | string): Promise<ShiftRecord | null> {
  const row = await powersync.getOptional<ShiftRow>(
    `
      SELECT
        id,
        user_id,
        branch_id,
        device_id,
        status,
        opening_cash,
        closing_cash,
        expected_cash,
        cash_difference,
        opened_at,
        closed_at,
        notes
      FROM shifts
      WHERE id = ?
      LIMIT 1
    `,
    [shiftId],
  );

  return row ? normalizeShift(row) : null;
}

async function getNextShiftId(): Promise<number> {
  const row = await powersync.getOptional<MaxIdRow>(
    `SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM shifts`,
  );

  // Math.max(..., 0) ensures we never derive a non-positive ID
  // even if all existing rows have negative IDs (legacy local-first inserts).
  return Math.max(toNumber(row?.max_id ?? 0), 0) + 1;
}

export async function getActiveShift(userId: number): Promise<ShiftRecord | null> {
  const row = await powersync.getOptional<ShiftRow>(
    `
      SELECT
        id,
        user_id,
        branch_id,
        device_id,
        status,
        opening_cash,
        closing_cash,
        expected_cash,
        cash_difference,
        opened_at,
        closed_at,
        notes
      FROM shifts
      WHERE user_id = ?
        AND status = ?
      ORDER BY opened_at DESC
      LIMIT 1
    `,
    [userId, SHIFT_STATUS.OPEN],
  );

  return row ? normalizeShift(row) : null;
}

export async function getShiftCashSummary(shiftId: number, openingCash: number): Promise<ShiftCashSummary> {
  const paymentSummary = await powersync.getOptional<CashSummaryRow>(
    `
      SELECT
        COALESCE(SUM(amount), 0) as cash_received,
        COALESCE(SUM(change_amount), 0) as change_given
      FROM payments
      WHERE shift_id = ?
        AND payment_method = 'cash'
    `,
    [shiftId],
  );

  const cashTxSummary = await powersync.getOptional<CashTxSummaryRow>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) as total_cash_in,
        COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) as total_cash_out
      FROM shift_cash_transactions
      WHERE shift_id = ?
    `,
    [CASH_TRANSACTION_TYPE.CASH_IN, CASH_TRANSACTION_TYPE.CASH_OUT, shiftId],
  );

  const cashReceived = toNumber(paymentSummary?.cash_received ?? 0);
  const changeGiven = toNumber(paymentSummary?.change_given ?? 0);
  const netCashSales = cashReceived - changeGiven;
  const totalCashIn = toNumber(cashTxSummary?.total_cash_in ?? 0);
  const totalCashOut = toNumber(cashTxSummary?.total_cash_out ?? 0);
  const expectedCash = openingCash + netCashSales + totalCashIn - totalCashOut;

  return {
    cashReceived,
    changeGiven,
    netCashSales,
    totalCashIn,
    totalCashOut,
    expectedCash,
  };
}

export async function openShift(userId: number, branchId: number, openingCash: number, deviceId: number | null = null): Promise<ShiftRecord> {
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw new Error('Opening cash must be a valid positive amount');
  }

  const existingShift = await getActiveShift(userId);
  if (existingShift) {
    // Repair legacy negative-ID shifts created before the MAX+1 fix.
    if (existingShift.id < 0) {
      const newId = await getNextShiftId();
      await powersync.execute(`UPDATE shifts   SET id = ? WHERE id = ?`, [newId, existingShift.id]);
      await powersync.execute(`UPDATE orders   SET shift_id = ? WHERE shift_id = ?`, [newId, existingShift.id]);
      await powersync.execute(`UPDATE payments SET shift_id = ? WHERE shift_id = ?`, [newId, existingShift.id]);
      console.log('[ShiftService] Repaired negative shift ID', existingShift.id, '->', newId);
      return (await getShiftById(newId)) ?? { ...existingShift, id: newId };
    }
    return existingShift;
  }

  const openedAt = new Date().toISOString();
  const localShiftId = await getNextShiftId();
  const localShiftIdText = String(localShiftId);

  await powersync.execute(
    `
      INSERT INTO shifts (
        id,
        user_id,
        branch_id,
        device_id,
        status,
        opening_cash,
        opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [localShiftIdText, userId, branchId, deviceId, SHIFT_STATUS.OPEN, openingCash, openedAt],
  );

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'shifts',
    userId: userId,
    branchId: branchId,
    newValues: { opening_cash: openingCash, opened_at: openedAt, device_id: deviceId },
    description: `Shift opened by user ${userId} on device ${deviceId}`,
  });
  addBreadcrumb('shift', 'Shift opened', { shiftId: localShiftId, userId, openingCash });

  const inserted = await getShiftById(localShiftIdText);
  if (inserted) {
    return inserted;
  }

  const activeShift = await getActiveShift(userId);
  if (!activeShift) {
    throw new Error('Failed to open shift');
  }

  return activeShift;
}

export async function closeShift(shiftId: number, closingCash: number): Promise<ShiftRecord> {
  if (!Number.isFinite(closingCash) || closingCash < 0) {
    throw new Error('Closing cash must be a valid positive amount');
  }

  const shift = await getShiftById(shiftId);

  if (!shift || shift.status !== SHIFT_STATUS.OPEN) {
    throw new Error('No active shift found to close');
  }

  const summary = await getShiftCashSummary(shiftId, shift.opening_cash);
  const expectedCash = summary.expectedCash;
  const cashDifference = closingCash - expectedCash;
  const closedAt = new Date().toISOString();

  await powersync.execute(
    `
      UPDATE shifts
      SET
        status = ?,
        closing_cash = ?,
        expected_cash = ?,
        cash_difference = ?,
        closed_at = ?
      WHERE id = ?
        AND status = ?
    `,
    [SHIFT_STATUS.CLOSED, closingCash, expectedCash, cashDifference, closedAt, shiftId, SHIFT_STATUS.OPEN],
  );

  void insertAuditLog({
    action: AUDIT_ACTION.STATUS_CHANGE,
    tableName: 'shifts',
    recordId: shiftId,
    userId: shift.user_id,
    newValues: {
      status: SHIFT_STATUS.CLOSED,
      closing_cash: closingCash,
      expected_cash: expectedCash,
      cash_difference: cashDifference,
    },
    description: `Shift closed: ${shiftId}`,
  });
  addBreadcrumb('shift', 'Shift closed', { shiftId, closingCash, expectedCash, cashDifference });

  const closedShift = await getShiftById(shiftId);

  if (!closedShift) {
    throw new Error('Shift closed, but could not load final summary');
  }

  return closedShift;
}

// ---------------------------------------------------------------------------
// Shift Cash Transactions (cash-in / cash-out mid-shift)
// ---------------------------------------------------------------------------

type ShiftCashTxRow = {
  id: number | string;
  shift_id: number | string;
  user_id: number | string;
  type: string;
  reason: string;
  amount: number | string | null;
  note: string | null;
  created_at: string;
  user_name?: string;
};

function normalizeShiftCashTx(row: ShiftCashTxRow): ShiftCashTransactionRecord {
  return {
    id: toNumber(row.id),
    shift_id: toNumber(row.shift_id),
    user_id: toNumber(row.user_id),
    type: row.type as CashTransactionType,
    reason: row.reason as CashTransactionReason,
    amount: toNumber(row.amount),
    note: row.note,
    created_at: row.created_at,
    user_name: row.user_name,
  };
}

/**
 * Add a cash transaction (cash-in or cash-out) to an open shift.
 * @param shiftId - The shift to add the transaction to
 * @param userId - The user performing the transaction
 * @param type - 'cash_in' or 'cash_out'
 * @param reason - Categorized reason (e.g. 'owner_withdrawal', 'supply_purchase')
 * @param amount - Always positive; direction determined by type
 * @param note - Optional free-text description
 * @returns The created transaction record
 */
export async function addCashTransaction(
  shiftId: number,
  userId: number,
  type: CashTransactionType,
  reason: CashTransactionReason,
  amount: number,
  note?: string | null,
): Promise<ShiftCashTransactionRecord> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const shift = await getShiftById(shiftId);
  if (!shift || shift.status !== SHIFT_STATUS.OPEN) {
    throw new Error('Cannot add cash transaction: shift is not open');
  }

  // For cash-out, validate there's enough cash in the drawer
  if (type === CASH_TRANSACTION_TYPE.CASH_OUT) {
    const summary = await getShiftCashSummary(shiftId, shift.opening_cash);
    if (amount > summary.expectedCash) {
      throw new Error(
        `Insufficient cash in drawer. Available: ${summary.expectedCash}, Requested: ${amount}`,
      );
    }
  }

  const createdAt = new Date().toISOString();

  // Get next ID for the transaction
  const maxIdRow = await powersync.getOptional<MaxIdRow>(
    `SELECT MAX(CAST(id AS INTEGER)) AS max_id FROM shift_cash_transactions`,
  );
  const nextId = Math.max(toNumber(maxIdRow?.max_id ?? 0), 0) + 1;

  await powersync.execute(
    `
      INSERT INTO shift_cash_transactions (
        id, shift_id, user_id, type, reason, amount, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [String(nextId), shiftId, userId, type, reason, amount, note ?? null, createdAt],
  );

  const typeLabel = type === CASH_TRANSACTION_TYPE.CASH_IN ? 'Cash In' : 'Cash Out';

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'shift_cash_transactions',
    recordId: nextId,
    userId,
    branchId: shift.branch_id,
    newValues: { shift_id: shiftId, type, reason, amount, note },
    description: `${typeLabel}: ${amount} (${reason})${note ? ` — ${note}` : ''}`,
  });

  return {
    id: nextId,
    shift_id: shiftId,
    user_id: userId,
    type,
    reason,
    amount,
    note: note ?? null,
    created_at: createdAt,
  };
}

/**
 * Get all cash transactions for a shift, ordered by most recent first.
 * Includes the user name who performed each transaction.
 * @param shiftId - The shift ID
 * @returns Array of cash transaction records
 */
export async function getShiftCashTransactions(
  shiftId: number,
): Promise<ShiftCashTransactionRecord[]> {
  const rows = await powersync.getAll<ShiftCashTxRow>(
    `
      SELECT
        sct.id,
        sct.shift_id,
        sct.user_id,
        sct.type,
        sct.reason,
        sct.amount,
        sct.note,
        sct.created_at,
        u.name as user_name
      FROM shift_cash_transactions sct
      LEFT JOIN users u ON u.id = sct.user_id
      WHERE sct.shift_id = ?
      ORDER BY sct.created_at DESC
    `,
    [shiftId],
  );

  return rows.map(normalizeShiftCashTx);
}
