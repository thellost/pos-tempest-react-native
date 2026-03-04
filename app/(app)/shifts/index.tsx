import { CashTransactionList } from '@/components/shift/CashTransactionList';
import { CashTransactionModal } from '@/components/shift/CashTransactionModal';
import type { CashTransactionReason, CashTransactionType } from '@/constants/enums';
import { useAuth } from '@/hooks/use-auth';
import { useShift } from '@/hooks/use-shift';
import { formatIDR } from '@/utils/currency';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export default function ShiftsScreen() {
  const { user } = useAuth();
  const { activeShift, summary, cashTransactions, lastClosedShift, loading, error, openShift, closeShift, addCashTransaction } = useShift();

  const [openingInput, setOpeningInput] = useState('500000');
  const [closingInput, setClosingInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCashTxModal, setShowCashTxModal] = useState(false);

  const openingAmount = useMemo(() => Number(openingInput || '0'), [openingInput]);
  const closingAmount = useMemo(() => Number(closingInput || '0'), [closingInput]);

  const previewDifference = useMemo(() => {
    if (!summary) {
      return 0;
    }

    return closingAmount - summary.expectedCash;
  }, [closingAmount, summary]);

  function applyKey(
    key: string,
    value: string,
    setter: (next: string) => void,
    maxLength: number = 9,
  ) {
    if (key === 'C') {
      setter('');
      return;
    }

    if (key === '⌫') {
      setter(value.slice(0, -1));
      return;
    }

    if (value.length >= maxLength) {
      return;
    }

    if (value === '0') {
      setter(key);
      return;
    }

    setter(`${value}${key}`);
  }

  async function onOpenShift() {
    if (openingAmount < 0 || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      await openShift(openingAmount);
      setClosingInput('');
    } finally {
      setSubmitting(false);
    }
  }

  async function onCloseShift() {
    if (!activeShift || closingAmount < 0 || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      await closeShift(closingAmount);
      setClosingInput('');
    } finally {
      setSubmitting(false);
    }
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
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="rounded-2xl border border-border bg-surface-card p-5">
        <Text className="text-pos-2xl font-bold text-pos-text">Shift Management</Text>
        <Text className="mt-2 text-pos-sm text-pos-text-muted">
          {user?.name ?? 'User'} · Branch {user?.branch_id ?? '-'}
        </Text>

        {loading && <Text className="mt-3 text-pos-sm text-pos-text-muted">Loading shift state...</Text>}

        {error && (
          <View className="mt-3 rounded-xl bg-pos-danger-muted p-3">
            <Text className="text-pos-sm text-pos-danger">{error}</Text>
          </View>
        )}
      </View>

      {activeShift ? (
        <View className="mt-4 rounded-2xl border border-pos-success/30 bg-pos-success-muted p-5">
          <Text className="text-pos-lg font-semibold text-pos-success">Active Shift</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">
            Opened: {formatTimestamp(activeShift.opened_at)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Opening Cash: {formatIDR(activeShift.opening_cash)}
          </Text>

          {summary && (
            <View className="mt-4 rounded-xl border border-border bg-surface p-4">
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
          )}

          <Pressable
            className="mt-4 rounded-xl border border-accent bg-accent-muted p-4"
            onPress={() => setShowCashTxModal(true)}>
            <Text className="text-center text-pos-base font-semibold text-accent">💵 Cash In / Out</Text>
          </Pressable>

          {activeShift && (
            <CashTransactionList transactions={cashTransactions} openingCash={activeShift.opening_cash} />
          )}

          <Text className="mt-4 text-pos-sm font-semibold text-pos-text">Closing Cash Input</Text>
          <View className="mt-2 rounded-xl border border-border bg-surface px-4 py-3">
            <Text className="text-pos-xl font-bold text-accent">{formatIDR(closingAmount)}</Text>
          </View>

          {summary && closingInput.length > 0 && (
            <View className="mt-3 rounded-xl border border-border bg-surface p-4">
              <Text className="text-pos-sm text-pos-text-muted">Expected: {formatIDR(summary.expectedCash)}</Text>
              <Text className="mt-1 text-pos-sm text-pos-text-muted">Actual: {formatIDR(closingAmount)}</Text>
              <Text
                className={`mt-1 text-pos-sm font-semibold ${
                  previewDifference >= 0 ? 'text-pos-success' : 'text-pos-danger'
                }`}>
                Difference: {formatIDR(previewDifference)}
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row flex-wrap justify-between">
            {keypad.map((key) => (
              <Pressable
                key={`close-${key}`}
                className="mb-3 h-14 w-[31%] items-center justify-center rounded-xl border border-border bg-surface-card"
                disabled={submitting}
                onPress={() => applyKey(key, closingInput, setClosingInput)}>
                <Text className="text-pos-lg font-semibold text-pos-text">{key}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            className="mt-2 rounded-xl bg-pos-warning-muted border border-pos-warning/30 p-4"
            disabled={submitting || closingInput.length === 0}
            onPress={onCloseShift}>
            <Text className="text-center text-pos-base font-semibold text-pos-warning">
              {submitting ? 'Closing Shift...' : 'Close Shift'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-4 rounded-2xl border border-border bg-surface-card p-5">
          <Text className="text-pos-lg font-semibold text-pos-text">Open New Shift</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">Enter opening cash amount</Text>

          <View className="mt-3 rounded-xl border border-border bg-surface px-4 py-3">
            <Text className="text-pos-xl font-bold text-accent">{formatIDR(openingAmount)}</Text>
          </View>

          <View className="mt-4 flex-row flex-wrap justify-between">
            {keypad.map((key) => (
              <Pressable
                key={`open-${key}`}
                className="mb-3 h-14 w-[31%] items-center justify-center rounded-xl border border-border bg-surface-card"
                disabled={submitting}
                onPress={() => applyKey(key, openingInput, setOpeningInput)}>
                <Text className="text-pos-lg font-semibold text-pos-text">{key}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            className="rounded-xl bg-accent p-4"
            disabled={submitting || openingInput.length === 0}
            onPress={onOpenShift}>
            <Text className="text-center text-pos-base font-semibold text-white">
              {submitting ? 'Opening Shift...' : 'Open Shift'}
            </Text>
          </Pressable>
        </View>
      )}

      {lastClosedShift && (
        <View className="mt-4 rounded-2xl border border-accent/30 bg-accent-muted p-5">
          <Text className="text-pos-base font-semibold text-accent">Last Closed Shift Summary</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">Closed: {formatTimestamp(lastClosedShift.closed_at)}</Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Opening: {formatIDR(lastClosedShift.opening_cash)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Closing: {formatIDR(lastClosedShift.closing_cash ?? 0)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Expected: {formatIDR(lastClosedShift.expected_cash ?? 0)}
          </Text>
          <Text
            className={`mt-1 text-pos-sm font-semibold ${
              (lastClosedShift.cash_difference ?? 0) >= 0 ? 'text-pos-success' : 'text-pos-danger'
            }`}>
            Difference: {formatIDR(lastClosedShift.cash_difference ?? 0)}
          </Text>
        </View>
      )}

      {/* Cash Transaction Modal */}
      <CashTransactionModal
        visible={showCashTxModal}
        availableCash={summary?.expectedCash ?? 0}
        onClose={() => setShowCashTxModal(false)}
        onSubmit={handleCashTransaction}
      />
    </ScrollView>
  );
}
