import { CashTransactionList } from '@/components/shift/CashTransactionList';
import { CashTransactionModal } from '@/components/shift/CashTransactionModal';
import { Button } from '@/components/ui';
import { PermissionGate } from '@/components/ui/PermissionGate';
import type { CashTransactionReason } from '@/constants/enums';
import { CASH_TRANSACTION_TYPE } from '@/constants/enums';
import { PERMISSION } from '@/constants/permissions';
import { useDevice } from '@/hooks/use-device';
import { useShift } from '@/hooks/use-shift';
import { formatIDR } from '@/utils/currency';
import { Banknote } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function CashScreen() {
  const { activeShift, summary, cashTransactions, addCashTransaction, loading } = useShift();
  const { registration } = useDevice();
  const [showCashTxModal, setShowCashTxModal] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!activeShift) {
    const branch = registration?.branch ?? null;
    const hasHours = !!(branch?.opening_time && branch?.closing_time);
    return (
      <View className="flex-1 bg-surface">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View className="rounded-sm border border-border bg-surface-card p-5">
            <Text className="text-pos-2xl font-bold text-pos-text">Cash Management</Text>
          </View>

          <View className="mt-6 items-center justify-center px-4 py-12">
            <View className="w-full max-w-md items-center rounded-sm border border-border bg-surface-card p-8">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface">
                <Banknote size={32} color="#94a3b8" />
              </View>
              <Text className="text-pos-xl font-bold text-pos-text">No active shift</Text>
              <Text className="mt-3 text-center text-pos-sm text-pos-text-muted">
                Cash transactions are tied to an active shift. The branch is outside operating hours,
                or the scheduler hasn&apos;t opened today&apos;s shift yet.
              </Text>
              {hasHours && (
                <Text className="mt-4 text-center text-pos-xs text-pos-text-muted">
                  <Text className="font-mono">
                    {branch!.opening_time} – {branch!.closing_time}
                  </Text>
                  {branch!.timezone ? ` (${branch!.timezone})` : ''}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  async function handleCashTransaction(
    reason: CashTransactionReason,
    amount: number,
    note?: string,
  ) {
    await addCashTransaction(CASH_TRANSACTION_TYPE.CASH_OUT, reason, amount, note);
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="rounded-sm border border-border bg-surface-card p-5">
          <Text className="text-pos-2xl font-bold text-pos-text">Cash Management</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">
            Shift opened: <Text className="font-mono">{formatTimestamp(activeShift.opened_at)}</Text>
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Opening cash: <Text className="font-mono">{formatIDR(activeShift.opening_cash)}</Text>
          </Text>
        </View>

        {summary && (
          <View className="mt-4 rounded-sm border border-border bg-surface-card p-5">
            <Text className="text-pos-base font-semibold text-pos-text">Cash Summary</Text>
            <View className="mt-3 rounded-sm border border-border bg-surface p-4">
              <Text className="text-pos-sm text-pos-text-muted">
                Cash sales: <Text className="font-mono">{formatIDR(summary.cashReceived)}</Text>
              </Text>
              {(summary.totalCashOut > 0) && (
                <View className="mt-2 border-t border-border pt-2">
                  {summary.totalCashOut > 0 && (
                    <Text className="text-pos-sm text-pos-danger">
                      - Cash Out: <Text className="font-mono">{formatIDR(summary.totalCashOut)}</Text>
                    </Text>
                  )}
                </View>
              )}
              <Text className="mt-2 text-pos-base font-bold text-pos-text">
                Expected cash now: <Text className="font-mono">{formatIDR(summary.expectedCash)}</Text>
              </Text>
            </View>
          </View>
        )}

        <PermissionGate permission={PERMISSION.CASH_MANAGEMENT}>
          <Button
            className="mt-4 items-center justify-center rounded-sm border border-accent bg-accent-muted p-4"
            onPress={() => setShowCashTxModal(true)}>
            <Text className="text-center text-pos-base font-semibold text-accent">Record Cash Out</Text>
          </Button>
        </PermissionGate>

        <CashTransactionList transactions={cashTransactions} />
      </ScrollView>

      <CashTransactionModal
        visible={showCashTxModal}
        onClose={() => setShowCashTxModal(false)}
        onSubmit={handleCashTransaction}
      />
    </View>
  );
}
