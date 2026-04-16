import type { CashTransactionReason, CashTransactionType } from '@/constants/enums';
import { ROLE_TYPE } from '@/constants/enums';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { captureError } from '@/lib/sentry';
import {
    addCashTransaction as addCashTxService,
    closeShift as closeShiftService,
    getActiveShift,
    getShiftCashSummary,
    getShiftCashTransactions,
    openShift as openShiftService,
    ShiftCashSummary,
    ShiftCashTransactionRecord,
    ShiftRecord,
} from '@/services/shift.service';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UseShiftReturn = {
  activeShift: ShiftRecord | null;
  summary: ShiftCashSummary | null;
  cashTransactions: ShiftCashTransactionRecord[];
  lastClosedShift: ShiftRecord | null;
  loading: boolean;
  error: string | null;
  isShiftOpen: boolean;
  requiresShift: boolean;
  autoShiftEnabled: boolean;
  refresh: () => Promise<void>;
  openShift: (openingCash: number) => Promise<ShiftRecord>;
  closeShift: (closingCash: number) => Promise<ShiftRecord>;
  addCashTransaction: (
    type: CashTransactionType,
    reason: CashTransactionReason,
    amount: number,
    note?: string | null,
  ) => Promise<ShiftCashTransactionRecord>;
};

/** Returns a YYYY-MM-DD date string in the given IANA timezone. */
function getLocalDateStr(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function useShift(): UseShiftReturn {
  const { user } = useAuth();
  const { registration } = useDevice();

  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [summary, setSummary] = useState<ShiftCashSummary | null>(null);
  const [cashTransactions, setCashTransactions] = useState<ShiftCashTransactionRecord[]>([]);
  const [lastClosedShift, setLastClosedShift] = useState<ShiftRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Tracks the date (YYYY-MM-DD) of the last successful auto-open to prevent re-triggering. */
  const lastAutoOpenDate = useRef<string | null>(null);

  // All roles that create/manage orders (cashier, manager, admin) require an open shift.
  // Chefs only work in the kitchen display and do not create orders, so they are exempt.
  const requiresShift = user?.role_name !== ROLE_TYPE.CHEF;
  const isShiftOpen = !requiresShift || Boolean(activeShift);
  const autoShiftEnabled = registration?.branch?.auto_shift ?? false;

  const refresh = useCallback(async () => {
    if (!user?.id || !user?.branch_id) {
      setActiveShift(null);
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const shift = await getActiveShift(user.branch_id);
      setActiveShift(shift);

      if (shift) {
        const nextSummary = await getShiftCashSummary(shift.id, shift.opening_cash);
        setSummary(nextSummary);

        const txs = await getShiftCashTransactions(shift.id);
        setCashTransactions(txs);
      } else {
        setSummary(null);
        setCashTransactions([]);

        // Auto-open shift if the branch has auto_shift enabled and the current
        // local time falls within the branch's operating window.
        const branch = registration?.branch;
        if (
          requiresShift &&
          branch?.auto_shift === true &&
          branch.opening_time &&
          branch.closing_time
        ) {
          const tz = branch.timezone ?? 'Asia/Jakarta';
          const todayStr = getLocalDateStr(tz);

          if (lastAutoOpenDate.current !== todayStr) {
            const nowLocal = new Intl.DateTimeFormat('en-GB', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date()); // "HH:MM"

            if (nowLocal >= branch.opening_time && nowLocal < branch.closing_time) {
              try {
                const rawDeviceId = registration?.device?.id ?? null;
                const deviceId = rawDeviceId !== null ? Number(rawDeviceId) : null;
                const newShift = await openShiftService(
                  user.role_name,
                  user.id,
                  user.branch_id,
                  0,
                  deviceId,
                );
                lastAutoOpenDate.current = todayStr;
                setActiveShift(newShift);

                const nextSummary = await getShiftCashSummary(newShift.id, newShift.opening_cash);
                setSummary(nextSummary);
              } catch (err) {
                console.warn('[useShift] Auto-open failed:', err);
                setError(err instanceof Error ? err.message : 'Auto-open shift failed');
              }
            }
          }
        }
      }
    } catch (err) {
      captureError(err, { module: 'shift', operation: 'refresh', level: 'warning' });
      setError(err instanceof Error ? err.message : 'Failed to load shift data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.branch_id, user?.role_name, requiresShift, registration]);

  const openShift = useCallback(
    async (openingCash: number) => {
      if (!user?.id || !user?.branch_id) {
        throw new Error('Cannot open shift: user profile is incomplete');
      }

      try {
        setError(null);
        const rawDeviceId = registration?.device?.id ?? null;
        const deviceId = rawDeviceId !== null ? Number(rawDeviceId) : null;
        const shift = await openShiftService(user.role_name, user.id, user.branch_id, openingCash, deviceId);
        setActiveShift(shift);

        const nextSummary = await getShiftCashSummary(shift.id, shift.opening_cash);
        setSummary(nextSummary);

        return shift;
      } catch (err) {
        captureError(err, { module: 'shift', operation: 'openShift', level: 'error' });
        const message = err instanceof Error ? err.message : 'Failed to open shift';
        setError(message);
        throw new Error(message);
      }
    },
    [user?.branch_id, user?.id, registration],
  );

  const closeShift = useCallback(
    async (closingCash: number) => {
      if (!activeShift) {
        throw new Error('No active shift to close');
      }

      try {
        setError(null);
        const closed = await closeShiftService(user?.role_name ?? '', activeShift.id, closingCash);
        setLastClosedShift(closed);
        setActiveShift(null);
        setSummary(null);
        setCashTransactions([]);
        return closed;
      } catch (err) {
        captureError(err, { module: 'shift', operation: 'closeShift', level: 'error' });
        const message = err instanceof Error ? err.message : 'Failed to close shift';
        setError(message);
        throw new Error(message);
      }
    },
    [activeShift, user?.role_name],
  );

  const addCashTransaction = useCallback(
    async (
      type: CashTransactionType,
      reason: CashTransactionReason,
      amount: number,
      note?: string | null,
    ) => {
      if (!activeShift) {
        throw new Error('No active shift for cash transaction');
      }
      if (!user?.id) {
        throw new Error('No user for cash transaction');
      }

      try {
        setError(null);
        const tx = await addCashTxService(activeShift.id, user.id, type, reason, amount, note);

        // Refresh summary and transactions list
        const nextSummary = await getShiftCashSummary(activeShift.id, activeShift.opening_cash);
        setSummary(nextSummary);

        const txs = await getShiftCashTransactions(activeShift.id);
        setCashTransactions(txs);

        return tx;
      } catch (err) {
        captureError(err, { module: 'shift', operation: 'addCashTransaction', level: 'error' });
        const message = err instanceof Error ? err.message : 'Failed to add cash transaction';
        setError(message);
        throw new Error(message);
      }
    },
    [activeShift, user?.id],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      activeShift,
      summary,
      cashTransactions,
      lastClosedShift,
      loading,
      error,
      isShiftOpen,
      requiresShift,
      autoShiftEnabled,
      refresh,
      openShift,
      closeShift,
      addCashTransaction,
    }),
    [activeShift, addCashTransaction, autoShiftEnabled, cashTransactions, closeShift, error, isShiftOpen, lastClosedShift, loading, openShift, refresh, requiresShift, summary],
  );
}
