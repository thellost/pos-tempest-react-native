import { CASH_TRANSACTION_TYPE } from '@/constants/enums';
import type { ShiftCashTransactionRecord } from '@/services/shift.service';
import { getCashTransactionReasonLabel } from '@/utils/cash-transaction-reason';
import { formatIDR } from '@/utils/currency';
import { Text, View } from 'react-native';

interface CashTransactionListProps {
  transactions: ShiftCashTransactionRecord[];
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CashTransactionList({ transactions }: CashTransactionListProps) {
  if (transactions.length === 0) {
    return (
      <View className="mt-4 rounded-xl border border-border bg-surface p-4">
        <Text className="text-center text-pos-sm text-pos-text-muted">No transaction records yet</Text>
      </View>
    );
  }

  return (
    <View className="mt-4 rounded-xl border border-border bg-surface-card p-4">
      <Text className="text-pos-base font-semibold text-pos-text">Transaction History</Text>
      <View className="mt-3 gap-3">
        {transactions.map((tx) => {
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
                    {getCashTransactionReasonLabel(tx.reason)}
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
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
