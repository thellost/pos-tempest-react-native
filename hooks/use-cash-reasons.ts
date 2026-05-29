import { useQuery } from '@powersync/react';
import { useEffect, useMemo, useState } from 'react';

import type { CashTransactionReasonRow } from '@/db/models';
import { useDevice } from '@/hooks/use-device';
import { CASH_TRANSACTION_REASON, type CashTransactionReason } from '@/constants/enums';
import { CASH_TRANSACTION_REASON_LABELS } from '@/utils/cash-transaction-reason';

export interface CashReasonOption {
  key: string;
  label: string;
  type: string | null;  // 'cash_in' | 'cash_out' | null
}

function staticReasons(): CashReasonOption[] {
  return Object.entries(CASH_TRANSACTION_REASON_LABELS).map(([key, label]) => ({
    key,
    label,
    type: key as CashTransactionReason === CASH_TRANSACTION_REASON.ANGSURAN || key === CASH_TRANSACTION_REASON.CASH_DEPOSIT
      ? 'cash_in'
      : key === CASH_TRANSACTION_REASON.OTHER
        ? null
        : 'cash_out',
  }));
}

export function useCashReasons() {
  const { registration } = useDevice();
  const branchId = Number(registration?.branch?.id ?? 0);

  const { data: dbReasons = [] } = useQuery<CashTransactionReasonRow>(
    `SELECT * FROM cash_transaction_reasons WHERE branch_id = ? AND is_active = 1 ORDER BY sort_order`,
    [branchId],
  );

  const reasons: CashReasonOption[] = useMemo(() => {
    if (dbReasons.length > 0) {
      return dbReasons.map((r) => ({
        key: r.key,
        label: r.label,
        type: r.type,
      }));
    }
    return staticReasons();
  }, [dbReasons]);

  return { reasons, dbReasons };
}
