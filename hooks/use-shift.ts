import { ROLE_TYPE } from '@/constants/enums';
import { useAuth } from '@/hooks/use-auth';
import {
    closeShift as closeShiftService,
    getActiveShift,
    getShiftCashSummary,
    openShift as openShiftService,
    ShiftCashSummary,
    ShiftRecord,
} from '@/services/shift.service';
import { useCallback, useEffect, useMemo, useState } from 'react';

type UseShiftReturn = {
  activeShift: ShiftRecord | null;
  summary: ShiftCashSummary | null;
  lastClosedShift: ShiftRecord | null;
  loading: boolean;
  error: string | null;
  isShiftOpen: boolean;
  requiresShift: boolean;
  refresh: () => Promise<void>;
  openShift: (openingCash: number) => Promise<ShiftRecord>;
  closeShift: (closingCash: number) => Promise<ShiftRecord>;
};

export function useShift(): UseShiftReturn {
  const { user } = useAuth();

  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [summary, setSummary] = useState<ShiftCashSummary | null>(null);
  const [lastClosedShift, setLastClosedShift] = useState<ShiftRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requiresShift = user?.role_name === ROLE_TYPE.CASHIER;
  // Non-cashier roles (Manager, Admin, Owner) can always operate without an open shift.
  // Only cashiers are required to have an active shift before taking orders.
  const isShiftOpen = !requiresShift || Boolean(activeShift);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setActiveShift(null);
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const shift = await getActiveShift(user.id);
      setActiveShift(shift);

      if (shift) {
        const nextSummary = await getShiftCashSummary(shift.id, shift.opening_cash);
        setSummary(nextSummary);
      } else {
        setSummary(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shift data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const openShift = useCallback(
    async (openingCash: number) => {
      if (!user?.id || !user?.branch_id) {
        throw new Error('Cannot open shift: user profile is incomplete');
      }

      try {
        setError(null);
        const shift = await openShiftService(user.id, user.branch_id, openingCash);
        setActiveShift(shift);

        const nextSummary = await getShiftCashSummary(shift.id, shift.opening_cash);
        setSummary(nextSummary);

        return shift;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open shift';
        setError(message);
        throw new Error(message);
      }
    },
    [user?.branch_id, user?.id],
  );

  const closeShift = useCallback(
    async (closingCash: number) => {
      if (!activeShift) {
        throw new Error('No active shift to close');
      }

      try {
        setError(null);
        const closed = await closeShiftService(activeShift.id, closingCash);
        setLastClosedShift(closed);
        setActiveShift(null);
        setSummary(null);
        return closed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to close shift';
        setError(message);
        throw new Error(message);
      }
    },
    [activeShift],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      activeShift,
      summary,
      lastClosedShift,
      loading,
      error,
      isShiftOpen,
      requiresShift,
      refresh,
      openShift,
      closeShift,
    }),
    [activeShift, closeShift, error, isShiftOpen, lastClosedShift, loading, openShift, refresh, requiresShift, summary],
  );
}
