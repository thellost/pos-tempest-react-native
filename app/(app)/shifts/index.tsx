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
  const { activeShift, summary, lastClosedShift, loading, error, openShift, closeShift } = useShift();

  const [openingInput, setOpeningInput] = useState('500000');
  const [closingInput, setClosingInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="rounded-2xl border border-white/10 bg-surface-soft p-5">
        <Text className="text-pos-2xl font-bold text-pos-text-strong">Shift Management</Text>
        <Text className="mt-2 text-pos-sm text-pos-muted">
          {user?.name ?? 'User'} · Branch {user?.branch_id ?? '-'}
        </Text>

        {loading && <Text className="mt-3 text-pos-sm text-pos-muted">Loading shift state...</Text>}

        {error && (
          <View className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <Text className="text-pos-sm text-red-300">{error}</Text>
          </View>
        )}
      </View>

      {activeShift ? (
        <View className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
          <Text className="text-pos-lg font-semibold text-green-300">Active Shift</Text>
          <Text className="mt-2 text-pos-sm text-pos-muted">
            Opened: {formatTimestamp(activeShift.opened_at)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-muted">
            Opening Cash: {formatIDR(activeShift.opening_cash)}
          </Text>

          {summary && (
            <View className="mt-4 rounded-lg border border-white/10 bg-surface p-3">
              <Text className="text-pos-sm text-pos-muted">
                Cash received: {formatIDR(summary.cashReceived)}
              </Text>
              <Text className="mt-1 text-pos-sm text-pos-muted">
                Change given: {formatIDR(summary.changeGiven)}
              </Text>
              <Text className="mt-1 text-pos-base font-semibold text-pos-text-strong">
                Expected cash now: {formatIDR(summary.expectedCash)}
              </Text>
            </View>
          )}

          <Text className="mt-4 text-pos-sm font-semibold text-pos-text-strong">Closing Cash Input</Text>
          <View className="mt-2 rounded-lg border border-white/10 bg-surface px-4 py-3">
            <Text className="text-pos-xl font-bold text-brand">{formatIDR(closingAmount)}</Text>
          </View>

          {summary && closingInput.length > 0 && (
            <View className="mt-3 rounded-lg border border-white/10 bg-surface p-3">
              <Text className="text-pos-sm text-pos-muted">Expected: {formatIDR(summary.expectedCash)}</Text>
              <Text className="mt-1 text-pos-sm text-pos-muted">Actual: {formatIDR(closingAmount)}</Text>
              <Text
                className={`mt-1 text-pos-sm font-semibold ${
                  previewDifference >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                Difference: {formatIDR(previewDifference)}
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row flex-wrap justify-between">
            {keypad.map((key) => (
              <Pressable
                key={`close-${key}`}
                className="mb-3 h-14 w-[31%] items-center justify-center rounded-lg border border-white/10 bg-surface active:bg-surface-soft"
                disabled={submitting}
                onPress={() => applyKey(key, closingInput, setClosingInput)}>
                <Text className="text-pos-lg font-semibold text-pos-text-strong">{key}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/20 p-4 active:bg-yellow-500/30"
            disabled={submitting || closingInput.length === 0}
            onPress={onCloseShift}>
            <Text className="text-center text-pos-base font-semibold text-yellow-300">
              {submitting ? 'Closing Shift...' : 'Close Shift'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-4 rounded-2xl border border-white/10 bg-surface-soft p-5">
          <Text className="text-pos-lg font-semibold text-pos-text-strong">Open New Shift</Text>
          <Text className="mt-2 text-pos-sm text-pos-muted">Enter opening cash amount</Text>

          <View className="mt-3 rounded-lg border border-white/10 bg-surface px-4 py-3">
            <Text className="text-pos-xl font-bold text-brand">{formatIDR(openingAmount)}</Text>
          </View>

          <View className="mt-4 flex-row flex-wrap justify-between">
            {keypad.map((key) => (
              <Pressable
                key={`open-${key}`}
                className="mb-3 h-14 w-[31%] items-center justify-center rounded-lg border border-white/10 bg-surface active:bg-surface-soft"
                disabled={submitting}
                onPress={() => applyKey(key, openingInput, setOpeningInput)}>
                <Text className="text-pos-lg font-semibold text-pos-text-strong">{key}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            className="rounded-lg bg-brand p-4 active:bg-brand/90"
            disabled={submitting || openingInput.length === 0}
            onPress={onOpenShift}>
            <Text className="text-center text-pos-base font-semibold text-white">
              {submitting ? 'Opening Shift...' : 'Open Shift'}
            </Text>
          </Pressable>
        </View>
      )}

      {lastClosedShift && (
        <View className="mt-4 rounded-2xl border border-brand/30 bg-brand/10 p-5">
          <Text className="text-pos-base font-semibold text-brand">Last Closed Shift Summary</Text>
          <Text className="mt-2 text-pos-sm text-pos-muted">Closed: {formatTimestamp(lastClosedShift.closed_at)}</Text>
          <Text className="mt-1 text-pos-sm text-pos-muted">
            Opening: {formatIDR(lastClosedShift.opening_cash)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-muted">
            Closing: {formatIDR(lastClosedShift.closing_cash ?? 0)}
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-muted">
            Expected: {formatIDR(lastClosedShift.expected_cash ?? 0)}
          </Text>
          <Text
            className={`mt-1 text-pos-sm font-semibold ${
              (lastClosedShift.cash_difference ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
            Difference: {formatIDR(lastClosedShift.cash_difference ?? 0)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
