import { SHIFT_STATUS } from '@/constants/enums';
import { powersync } from '@/db/provider';

export type ShiftRecord = {
  id: number;
  user_id: number;
  branch_id: number;
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

type MinIdRow = {
  min_id: number | string | null;
};

export type ShiftCashSummary = {
  cashReceived: number;
  changeGiven: number;
  netCashSales: number;
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

async function getNextLocalShiftId(): Promise<number> {
  const row = await powersync.getOptional<MinIdRow>(
    `
      SELECT MIN(CAST(id AS INTEGER)) AS min_id
      FROM shifts
    `,
  );

  const minId = toNumber(row?.min_id ?? 0);

  // Use negative ids for local-first inserts to avoid clashing with server-generated positive ids.
  return minId <= 0 ? minId - 1 : -1;
}

export async function getActiveShift(userId: number): Promise<ShiftRecord | null> {
  const row = await powersync.getOptional<ShiftRow>(
    `
      SELECT
        id,
        user_id,
        branch_id,
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

  const cashReceived = toNumber(paymentSummary?.cash_received ?? 0);
  const changeGiven = toNumber(paymentSummary?.change_given ?? 0);
  const netCashSales = cashReceived - changeGiven;
  const expectedCash = openingCash + netCashSales;

  return {
    cashReceived,
    changeGiven,
    netCashSales,
    expectedCash,
  };
}

export async function openShift(userId: number, branchId: number, openingCash: number): Promise<ShiftRecord> {
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw new Error('Opening cash must be a valid positive amount');
  }

  const existingShift = await getActiveShift(userId);
  if (existingShift) {
    return existingShift;
  }

  const openedAt = new Date().toISOString();
  const localShiftId = await getNextLocalShiftId();
  const localShiftIdText = String(localShiftId);

  await powersync.execute(
    `
      INSERT INTO shifts (
        id,
        user_id,
        branch_id,
        status,
        opening_cash,
        opened_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [localShiftIdText, userId, branchId, SHIFT_STATUS.OPEN, openingCash, openedAt],
  );

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

  const closedShift = await getShiftById(shiftId);

  if (!closedShift) {
    throw new Error('Shift closed, but could not load final summary');
  }

  return closedShift;
}
