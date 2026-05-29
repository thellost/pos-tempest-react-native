import * as Crypto from 'expo-crypto';

import type { CashTransactionType } from '@/constants/enums';
import { AUDIT_ACTION, CASH_TRANSACTION_TYPE, SHIFT_STATUS } from '@/constants/enums';
import { hasPermission, PERMISSION } from '@/constants/permissions';
import type { Branch } from '@/db/models';
import { powersync } from '@/db/provider';
import { addBreadcrumb, captureMessage, startSpan } from '@/lib/sentry';
import { insertAuditLog } from '@/services/audit.service';
import {
  isWithinOperatingWindow,
  operatingDayKey,
  TZ_FALLBACK,
} from '@/utils/branch-schedule';
import { getCashTransactionReasonLabel } from '@/utils/cash-transaction-reason';

/** Minimal branch shape required by the auto-shift safeguard helpers. */
export type AutoShiftBranch = Pick<
  Branch,
  'id' | 'timezone' | 'opening_time' | 'closing_time'
> & { auto_shift?: boolean };

export type ShiftRecord = {
  id: string;
  user_id: number;
  branch_id: number;
  device_id: string | null;
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
  device_id: string | null;
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

export type ShiftCashTransactionRecord = {
  id: string;
  shift_id: string;
  user_id: number;
  type: CashTransactionType;
  reason: string;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function normalizeShift(row: ShiftRow): ShiftRecord {
  return {
    id: String(row.id),
    user_id: toNumber(row.user_id),
    branch_id: toNumber(row.branch_id),
    device_id: row.device_id ?? null,
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

async function getShiftById(shiftId: string): Promise<ShiftRecord | null> {
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

import { captureError } from '@/lib/sentry';

export async function getActiveShift(branchId: number, context?: { deviceId?: string | null; userId?: number | null; sessionId?: string }): Promise<ShiftRecord | null> {
  let row: ShiftRow | null = null;
  try {
    row = await powersync.getOptional<ShiftRow>(
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
        WHERE branch_id = ?
          AND status = ?
        ORDER BY opened_at ASC
        LIMIT 1
      `,
      [branchId, SHIFT_STATUS.OPEN],
    );
  } catch (error) {
    captureError(error, {
      module: 'shift.service',
      operation: 'getActiveShift.query',
      tags: {
        branchId: String(branchId),
        deviceId: context?.deviceId ?? 'unknown',
        userId: context?.userId ? String(context.userId) : 'unknown',
        sessionId: context?.sessionId ?? 'unknown',
      },
      extras: {
        query: 'SELECT ... FROM shifts WHERE branch_id = ? AND status = ? ORDER BY opened_at DESC LIMIT 1',
        params: [branchId, SHIFT_STATUS.OPEN],
      },
      level: 'error',
    });
    return null;
  }

  if (!row) {
    return null;
  }

  if (!isUuid(String(row.id))) {
    captureError('getActiveShift: stale non-UUID shift id in local cache — ignoring', {
      module: 'shift.service',
      operation: 'getActiveShift.staleId',
      tags: {
        branchId: String(branchId),
        deviceId: context?.deviceId ?? 'unknown',
        userId: context?.userId ? String(context.userId) : 'unknown',
        sessionId: context?.sessionId ?? 'unknown',
        staleShiftId: String(row.id),
      },
      level: 'warning',
    });
    // Remove the invalid shift from local DB
    await powersync.execute(
      'DELETE FROM shifts WHERE id = ?',
      [row.id]
    );
    return null;
  }

  return normalizeShift(row);
}

export async function getShiftCashSummary(shiftId: string, openingCash: number): Promise<ShiftCashSummary> {
  const paymentSummary = await powersync.getOptional<CashSummaryRow>(
    `
      SELECT
        COALESCE(SUM(amount - change_amount), 0) as cash_received,
        0 as change_given
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

export async function openShift(callerRole: string, userId: number, branchId: number, openingCash: number = 0, deviceId: string | null = null, system: boolean = false): Promise<ShiftRecord> {
  if (!system && !hasPermission(callerRole, PERMISSION.MANAGE_SHIFT)) {
    throw new Error('[ShiftService] Permission denied: manage_shift required');
  }

  if (deviceId === null) {
    if (!system) {
      throw new Error('[ShiftService] Cannot open shift without a device ID');
    } else {
      console.warn('[ShiftService] openShift called with null deviceId (system=true) — shift will have no device_id');
    }
  }

  return startSpan({ name: 'shift.open', op: 'db.powersync' }, async () => {
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw new Error('Opening cash must be a valid positive amount');
  }

  const existingShift = await getActiveShift(branchId);
  if (existingShift) {
    return existingShift;
  }

  const openedAt = new Date().toISOString();
  const localShiftId = Crypto.randomUUID();

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
    [localShiftId, userId, branchId, deviceId, SHIFT_STATUS.OPEN, openingCash, openedAt],
  );

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'shifts',
    recordId: localShiftId,
    userId: userId,
    branchId: branchId,
    newValues: { opening_cash: openingCash, opened_at: openedAt, device_id: deviceId },
    description: `Shift opened by user ${userId} on device ${deviceId}`,
  });
  addBreadcrumb('shift', 'Shift opened', { shiftId: localShiftId, userId, openingCash });

  const inserted = await getShiftById(localShiftId);
  if (inserted) {
    return inserted;
  }

  const activeShift = await getActiveShift(branchId);
  if (!activeShift) {
    throw new Error('Failed to open shift');
  }

  return activeShift;
  }); // end shift.open span
}

export async function closeShift(
  callerRole: string,
  shiftId: string,
  closingCash: number,
  options?: { auto?: boolean; system?: boolean; notes?: string | null },
): Promise<ShiftRecord> {
  const auto = options?.auto === true;
  const system = options?.system === true;

  if (!system && !hasPermission(callerRole, PERMISSION.MANAGE_SHIFT)) {
    throw new Error('[ShiftService] Permission denied: manage_shift required');
  }

  return startSpan({ name: 'shift.close', op: 'db.powersync' }, async () => {

  const shift = await getShiftById(shiftId);

  // Monitoring: Log if shift is closed unexpectedly during user activity
  if (!options?.auto && !options?.system && shift) {
    void insertAuditLog({
      action: AUDIT_ACTION.STATUS_CHANGE,
      tableName: 'shifts',
      recordId: shiftId,
      userId: shift.user_id,
      newValues: { status: SHIFT_STATUS.CLOSED },
      description: `Shift closed (monitor): shiftId=${shiftId}, user=${shift.user_id}, device=${shift.device_id}`,
    });
  }

  if (!shift || shift.status !== SHIFT_STATUS.OPEN) {
    if (auto || system) {
      console.warn('[ShiftService] closeShift: shift already closed or missing', shiftId);
      if (shift) return shift;
      throw new Error('No active shift found to close');
    }
    throw new Error('No active shift found to close');
  }

  const summary = await getShiftCashSummary(shiftId, shift.opening_cash);
  const expectedCash = summary.expectedCash;

  // For auto-close, derive closing cash from expected so cash_difference = 0.
  const effectiveClosingCash = auto ? expectedCash : closingCash;

  if (!auto && (!Number.isFinite(effectiveClosingCash) || effectiveClosingCash < 0)) {
    throw new Error('Closing cash must be a valid positive amount');
  }

  const cashDifference = effectiveClosingCash - expectedCash;
  const closedAt = new Date().toISOString();
  const finalNotes = options?.notes ?? (auto ? 'auto-closed by client safeguard' : shift.notes);

  await powersync.execute(
    `
      UPDATE shifts
      SET
        status = ?,
        closing_cash = ?,
        expected_cash = ?,
        cash_difference = ?,
        closed_at = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
        AND status = ?
    `,
    [SHIFT_STATUS.CLOSED, effectiveClosingCash, expectedCash, cashDifference, closedAt, finalNotes, shiftId, SHIFT_STATUS.OPEN],
  );

  void insertAuditLog({
    action: AUDIT_ACTION.STATUS_CHANGE,
    tableName: 'shifts',
    recordId: shiftId,
    userId: shift.user_id,
    newValues: {
      status: SHIFT_STATUS.CLOSED,
      closing_cash: effectiveClosingCash,
      expected_cash: expectedCash,
      cash_difference: cashDifference,
      auto: auto || undefined,
    },
    description: auto ? `Shift auto-closed: ${shiftId}` : `Shift closed: ${shiftId}`,
  });
  addBreadcrumb('shift', auto ? 'Shift auto-closed' : 'Shift closed', { shiftId, closingCash: effectiveClosingCash, expectedCash, cashDifference });

  if (!auto && cashDifference !== 0) {
    captureMessage('Shift closing balance mismatch', 'warning', {
      shiftId,
      closingCash: effectiveClosingCash,
      expectedCash,
      cashDifference,
    });
  }

  const closedShift = await getShiftById(shiftId);

  if (!closedShift) {
    throw new Error('Shift closed, but could not load final summary');
  }

  return closedShift;
  }); // end shift.close span
}

// ---------------------------------------------------------------------------
// Auto-shift safeguard (client-side fallback for the backend Go scheduler)
// ---------------------------------------------------------------------------

/**
 * Close any open shifts on the given branch whose operating-day key has
 * rolled over, or where the current time is outside the operating window.
 * Returns the number of shifts closed. Failures are logged and skipped.
 */
export async function autoCloseStaleShifts(branch: AutoShiftBranch): Promise<number> {
  if (branch.auto_shift === false) return 0;

  const opening = branch.opening_time ?? '';
  const closing = branch.closing_time ?? '';
  if (!opening || !closing) return 0;

  const tz = branch.timezone ?? TZ_FALLBACK;
  const branchId = toNumber(branch.id);

  const rows = await powersync.getAll<ShiftRow>(
    `
      SELECT
        id, user_id, branch_id, device_id, status,
        opening_cash, closing_cash, expected_cash, cash_difference,
        opened_at, closed_at, notes
      FROM shifts
      WHERE branch_id = ?
        AND status = ?
    `,
    [branchId, SHIFT_STATUS.OPEN],
  );

  const now = new Date();
  const currentDayKey = operatingDayKey(opening, closing, tz, now);
  const inWindow = isWithinOperatingWindow(opening, closing, tz, now);

  let closedCount = 0;
  for (const row of rows) {
    const shift = normalizeShift(row);
    let openedAt: Date;
    try {
      openedAt = new Date(shift.opened_at);
    } catch {
      openedAt = now;
    }
    const shiftDayKey = operatingDayKey(opening, closing, tz, openedAt);
    const stale = shiftDayKey !== currentDayKey || !inWindow;

    if (!stale) continue;

    try {
      await closeShift('', shift.id, 0, { auto: true, system: true });
      closedCount += 1;
    } catch (err) {
      console.warn('[ShiftService] autoCloseStaleShifts: failed to close shift', shift.id, err);
    }
  }

  try {
    await deduplicateOpenShifts(branchId);
  } catch (err) {
    console.warn('[ShiftService] autoCloseStaleShifts: deduplication failed', err);
  }

  return closedCount;
}

/**
 * Close all but the oldest open shift for a branch.
 * Guards against the race condition where the backend scheduler and the
 * device both insert an OPEN shift before PowerSync can sync the server
 * record to the device. Oldest shift wins — it is most likely the
 * backend-authoritative one. Returns the number of duplicate shifts closed.
 */
async function deduplicateOpenShifts(branchId: number): Promise<number> {
  const rows = await powersync.getAll<ShiftRow>(
    `
      SELECT
        id, user_id, branch_id, device_id, status,
        opening_cash, closing_cash, expected_cash, cash_difference,
        opened_at, closed_at, notes
      FROM shifts
      WHERE branch_id = ?
        AND status = ?
      ORDER BY opened_at ASC
    `,
    [branchId, SHIFT_STATUS.OPEN],
  );

  if (rows.length <= 1) return 0;

  const [, ...duplicates] = rows;
  captureMessage(
    `[ShiftService] deduplicateOpenShifts: found ${rows.length} open shifts for branch ${branchId}, closing ${duplicates.length} duplicate(s)`,
    'warning',
    { branchId, keepShiftId: String(rows[0].id), duplicateCount: duplicates.length },
  );

  let closedCount = 0;
  for (const row of duplicates) {
    try {
      await closeShift('', String(row.id), 0, { auto: true, system: true, notes: 'auto-closed: duplicate shift deduplication' });
      closedCount += 1;
    } catch (err) {
      console.warn('[ShiftService] deduplicateOpenShifts: failed to close duplicate shift', row.id, err);
    }
  }

  return closedCount;
}

/**
 * Ensure a shift exists for the current operating window. Acts as a
 * client-side safeguard to the backend scheduler:
 *   1. Auto-close stale open shifts.
 *   2. Return the current active shift if one exists.
 *   3. If `branch.auto_shift === true` AND the current time is within the
 *      operating window, auto-open a new shift with opening_cash = 0.
 *   4. Otherwise return null.
 */
export async function ensureShiftForNow(
  branch: AutoShiftBranch,
  userId: number,
  deviceId: string | null,
): Promise<ShiftRecord | null> {
  const branchId = toNumber(branch.id);

  try {
    await autoCloseStaleShifts(branch);
  } catch (err) {
    console.warn('[ShiftService] ensureShiftForNow: autoCloseStaleShifts failed', err);
  }

  const existing = await getActiveShift(branchId);
  if (existing) return existing;

  if (branch.auto_shift !== true) return null;

  const opening = branch.opening_time ?? '';
  const closing = branch.closing_time ?? '';
  if (!opening || !closing) return null;

  const tz = branch.timezone ?? TZ_FALLBACK;
  if (!isWithinOperatingWindow(opening, closing, tz)) return null;

  if (deviceId === null) {
    console.warn('[ShiftService] ensureShiftForNow: deviceId is null, shift will have no device_id');
  }

  try {
    const result = await openShift('', userId, branchId, 0, deviceId, true);
    // Deduplicate in case a backend-created shift synced in after we queried
    // getActiveShift above but before/during our insert.
    try {
      await deduplicateOpenShifts(branchId);
    } catch (err) {
      console.warn('[ShiftService] ensureShiftForNow: deduplication failed', err);
    }
    return result;
  } catch (err) {
    console.warn('[ShiftService] ensureShiftForNow: openShift failed', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shift Cash Transactions (cash-in / cash-out mid-shift)
// ---------------------------------------------------------------------------

type ShiftCashTxRow = {
  id: string;
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
    id: String(row.id),
    shift_id: String(row.shift_id),
    user_id: toNumber(row.user_id),
    type: row.type as CashTransactionType,
    reason: row.reason,
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
 * @param reason - Categorized reason (e.g. 'gaji', 'supply_purchase')
 * @param amount - Always positive; direction determined by type
 * @param note - Optional free-text description
 * @returns The created transaction record
 */
export async function addCashTransaction(
  shiftId: string,
  userId: number,
  type: CashTransactionType,
  reason: string,
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

  const createdAt= new Date().toISOString();

  const nextId = Crypto.randomUUID();

  await powersync.execute(
    `
      INSERT INTO shift_cash_transactions (
        id, shift_id, user_id, type, reason, amount, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [nextId, shiftId, userId, type, reason, amount, note ?? null, createdAt],
  );

  const typeLabel = type === CASH_TRANSACTION_TYPE.CASH_IN ? 'Cash In' : 'Cash Out';
  const reasonLabel = getCashTransactionReasonLabel(reason);

  void insertAuditLog({
    action: AUDIT_ACTION.INSERT,
    tableName: 'shift_cash_transactions',
    recordId: nextId,
    userId,
    branchId: shift.branch_id,
    newValues: { shift_id: shiftId, type, reason, amount, note },
    description: `${typeLabel}: ${amount} (${reasonLabel})${note ? ` — ${note}` : ''}`,
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
  shiftId: string,
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
