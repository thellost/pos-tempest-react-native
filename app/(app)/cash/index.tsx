import { CashTransactionList } from '@/components/shift/CashTransactionList';
import { CashTransactionModal } from '@/components/shift/CashTransactionModal';
import type { CashTransactionReason, CashTransactionType } from '@/constants/enums';
import { useShift } from '@/hooks/use-shift';
import { formatIDR } from '@/utils/currency';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui';

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
  const [showCashTxModal, setShowCashTxModal] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!activeShift) {
    return <Redirect href="/(app)/shifts" />;
  }

  async function handleCashTransaction(
    type: CashTransactionType,
    reason: CashTransactionReason,
    amount: number,
    note?: string,
  ) {
    await addCashTransaction(type, reason, amount, note);
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="rounded-2xl border border-border bg-surface-card p-5">
          <Text className="text-pos-2xl font-bold text-pos-text">Cash Management</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">
            Shift opened: {formatTimestamp(activeShift.opened_at)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Opening cash: {formatIDR(activeShift.opening_cash)}
          </Text>
        </View>

        {summary && (
          <View className="mt-4 rounded-2xl border border-border bg-surface-card p-5">
            <Text className="text-pos-base font-semibold text-pos-text">Cash Summary</Text>
            <View className="mt-3 rounded-xl border border-border bg-surface p-4">
              <Text className="text-pos-sm text-pos-text-muted">
                Cash received: {formatIDR(summary.cashReceived)}
              </Text>
              <Text className="mt-1 text-pos-sm text-pos-text-muted">
                Change given: {formatIDR(summary.changeGiven)}
              </Text>
              <Text className="mt-1 text-pos-sm text-pos-text-muted">
                Net sales: {formatIDR(summary.netCashSales)}
              </Text>
              {(summary.totalCashIn > 0 || summary.totalCashOut > 0) && (
                <View className="mt-2 border-t border-border pt-2">
                  {summary.totalCashIn > 0 && (
                    <Text className="text-pos-sm text-pos-success">
                      + Cash In: {formatIDR(summary.totalCashIn)}
                    </Text>
                  )}
                  {summary.totalCashOut > 0 && (
                    <Text className="text-pos-sm text-pos-danger">
                      - Cash Out: {formatIDR(summary.totalCashOut)}
                    </Text>
                  )}
                </View>
              )}
              <Text className="mt-2 text-pos-base font-bold text-pos-text">
                Expected cash now: {formatIDR(summary.expectedCash)}
              </Text>
            </View>
          </View>
        )}

        <Button
          className="mt-4 items-center justify-center rounded-xl border border-accent bg-accent-muted p-4"
          onPress={() => setShowCashTxModal(true)}>
          <Text className="text-center text-pos-base font-semibold text-accent">Cash In / Out</Text>
        </Button>

        <CashTransactionList transactions={cashTransactions} openingCash={activeShift.opening_cash} />
      </ScrollView>

      <CashTransactionModal
        visible={showCashTxModal}
        availableCash={summary?.expectedCash ?? 0}
        onClose={() => setShowCashTxModal(false)}
        onSubmit={handleCashTransaction}
      />
    </View>
  );
}
