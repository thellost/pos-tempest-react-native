import type { CashTransactionReason, CashTransactionType } from '@/constants/enums';
import { ROLE_TYPE } from '@/constants/enums';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { captureError } from '@/lib/sentry';
import {
    addCashTransaction as addCashTxService,
    autoCloseStaleShifts,
    AutoShiftBranch,
    ensureShiftForNow,
    getActiveShift,
    getShiftCashSummary,
    getShiftCashTransactions,
    ShiftCashSummary,
    ShiftCashTransactionRecord,
    ShiftRecord,
} from '@/services/shift.service';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

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
  /** @deprecated Manual openShift removed: shifts are auto-managed. Stub kept for transitional compatibility. */
  openShift: (openingCash: number) => Promise<ShiftRecord>;
  /** @deprecated Manual closeShift removed: shifts are auto-managed. Stub kept for transitional compatibility. */
  closeShift: (closingCash: number) => Promise<ShiftRecord>;
  addCashTransaction: (
    type: CashTransactionType,
    reason: CashTransactionReason,
    amount: number,
    note?: string | null,
  ) => Promise<ShiftCashTransactionRecord>;
};

export function useShift(): UseShiftReturn {
  const { user } = useAuth();
  const { registration } = useDevice();

  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [summary, setSummary] = useState<ShiftCashSummary | null>(null);
  const [cashTransactions, setCashTransactions] = useState<ShiftCashTransactionRecord[]>([]);
  const [lastClosedShift, setLastClosedShift] = useState<ShiftRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All roles that create/manage orders (cashier, manager, admin) require an open shift.
  // Chefs only work in the kitchen display and do not create orders, so they are exempt.
  const requiresShift = user?.role_name !== ROLE_TYPE.CHEF;
  const isShiftOpen = !requiresShift || Boolean(activeShift);
  const autoShiftEnabled = registration?.branch?.auto_shift ?? false;

  const refresh = useCallback(async () => {
    const branch = registration?.branch;
    if (!user?.id || !user?.branch_id || !branch) {
      setActiveShift(null);
      setSummary(null);
      setCashTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const autoBranch: AutoShiftBranch = {
        id: branch.id,
        timezone: branch.timezone,
        opening_time: branch.opening_time,
        closing_time: branch.closing_time,
        auto_shift: branch.auto_shift,
      };

      if (
        requiresShift &&
        autoBranch.auto_shift === true &&
        autoBranch.opening_time &&
        autoBranch.closing_time
      ) {
        const rawDeviceId = registration?.device?.id ?? null;
        const deviceId = rawDeviceId !== null ? Number(rawDeviceId) : null;

        if (deviceId === null) {
          console.warn('[useShift] deviceId is null — shift will have no device_id');
        }

        try {
          await autoCloseStaleShifts(autoBranch);
        } catch (err) {
          console.warn('[useShift] autoCloseStaleShifts failed:', err);
        }

        try {
          await ensureShiftForNow(autoBranch, user.id, deviceId);
        } catch (err) {
          console.warn('[useShift] ensureShiftForNow failed:', err);
        }
      }

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
      }
    } catch (err) {
      captureError(err, { module: 'shift', operation: 'refresh', level: 'warning' });
      setError(err instanceof Error ? err.message : 'Failed to load shift data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.branch_id, user?.role_name, requiresShift, registration]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

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

  // Periodic safeguard: re-evaluate shift state every 60s and on app foreground.
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshRef.current();
    }, 60_000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshRef.current();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const openShift = useCallback(async (_openingCash: number): Promise<ShiftRecord> => {
    throw new Error('Manual openShift removed: shifts are auto-managed');
  }, []);

  const closeShift = useCallback(async (_closingCash: number): Promise<ShiftRecord> => {
    throw new Error('Manual closeShift removed: shifts are auto-managed');
  }, []);

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
