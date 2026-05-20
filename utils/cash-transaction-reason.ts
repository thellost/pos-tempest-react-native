import type { CashTransactionReason } from '@/constants/enums';
import { CASH_TRANSACTION_REASON } from '@/constants/enums';

export const CASH_TRANSACTION_REASON_LABELS: Record<CashTransactionReason, string> = {
  [CASH_TRANSACTION_REASON.GAJI]: 'Gaji',
  [CASH_TRANSACTION_REASON.SUPPLY_PURCHASE]: 'Supply Purchase',
  [CASH_TRANSACTION_REASON.PENGELUARAN_PRIBADI]: 'Pengeluaran Pribadi',
  [CASH_TRANSACTION_REASON.PETTY_CASH]: 'Petty Cash',
  [CASH_TRANSACTION_REASON.ANGSURAN]: 'Angsuran',
  [CASH_TRANSACTION_REASON.CASH_DEPOSIT]: 'Cash Deposit',
  [CASH_TRANSACTION_REASON.OPERASIONAL]: 'Operasional',
  [CASH_TRANSACTION_REASON.OTHER]: 'Other',
};

const LEGACY_CASH_TRANSACTION_REASON_LABELS: Record<string, string> = {
  tip_out: 'Angsuran',
  change_refill: 'Operasional',
  owner_withdrawal: 'Pengeluaran Pribadi',
  staff_advance: 'Gaji',
};

function formatFallbackReasonLabel(reason: string): string {
  return reason
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getCashTransactionReasonLabel(reason: string): string {
  return (
    CASH_TRANSACTION_REASON_LABELS[reason as CashTransactionReason] ??
    LEGACY_CASH_TRANSACTION_REASON_LABELS[reason] ??
    formatFallbackReasonLabel(reason)
  );
}
