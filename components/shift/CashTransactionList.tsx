import { CASH_TRANSACTION_TYPE } from '@/constants/enums';
import type { ShiftCashTransactionRecord } from '@/services/shift.service';
import { formatIDR } from '@/utils/currency';
import { Text, View } from 'react-native';

interface CashTransactionListProps {
  transactions: ShiftCashTransactionRecord[];
  openingCash: number;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReasonLabel(reason: string): string {
  return reason
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function CashTransactionList({ transactions, openingCash }: CashTransactionListProps) {
  if (transactions.length === 0) {
    return (
      <View className="mt-4 rounded-xl border border-border bg-surface p-4">
        <Text className="text-center text-pos-sm text-pos-text-muted">No cash transactions yet</Text>
      </View>
    );
  }

  // Calculate running balance (reverse chronologically since transactions are DESC)
  let runningBalance = openingCash;
  const transactionsWithBalance = [...transactions]
    .reverse()
    .map((tx) => {
      if (tx.type === CASH_TRANSACTION_TYPE.CASH_IN) {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }
      return { ...tx, balance: runningBalance };
    })
    .reverse(); // Back to DESC order for display

  return (
    <View className="mt-4 rounded-xl border border-border bg-surface-card p-4">
      <Text className="text-pos-base font-semibold text-pos-text">Cash Transaction History</Text>
      <View className="mt-3 gap-3">
        {transactionsWithBalance.map((tx) => {
          const isCashIn = tx.type === CASH_TRANSACTION_TYPE.CASH_IN;
          return (
            <View key={tx.id} className="rounded-xl border border-border bg-surface p-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`rounded px-2 py-1 ${isCashIn ? 'bg-pos-success-muted' : 'bg-pos-danger-muted'}`}>
                      <Text className={`text-pos-xs font-semibold ${isCashIn ? 'text-pos-success' : 'text-pos-danger'}`}>
                        {isCashIn ? 'Cash In' : 'Cash Out'}
                      </Text>
                    </View>
                    <Text className="text-pos-xs text-pos-text-muted">{formatTimestamp(tx.created_at)}</Text>
                  </View>

                  <Text className="mt-1 text-pos-sm font-semibold text-pos-text">
                    {formatReasonLabel(tx.reason)}
                  </Text>

                  {tx.note && <Text className="mt-1 text-pos-xs text-pos-text-muted">{tx.note}</Text>}

                  {tx.user_name && (
                    <Text className="mt-1 text-pos-xs text-pos-text-muted">by {tx.user_name}</Text>
                  )}
                </View>

                <View className="items-end">
                  <Text className={`text-pos-lg font-bold ${isCashIn ? 'text-pos-success' : 'text-pos-danger'}`}>
                    {isCashIn ? '+' : '-'}
                    {formatIDR(tx.amount)}
                  </Text>
                  <Text className="mt-1 text-pos-xs text-pos-text-muted">Balance: {formatIDR(tx.balance)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
