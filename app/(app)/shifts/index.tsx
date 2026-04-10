import { Button } from '@/components/ui';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { PERMISSION } from '@/constants/permissions';
import { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useShift } from '@/hooks/use-shift';
import { formatIDR } from '@/utils/currency';
import { router } from 'expo-router';
import { Banknote } from 'lucide-react-native';
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
      <View className="rounded-sm border border-border bg-surface-card p-5">
        <Text className="text-pos-2xl font-bold text-pos-text">Shift Management</Text>
        <Text className="mt-2 text-pos-sm text-pos-text-muted">
          {user?.name ?? 'User'} · Branch {user?.branch_id ?? '-'}
        </Text>

        {loading && <Text className="mt-3 text-pos-sm text-pos-text-muted">Loading shift state...</Text>}

        {error && (
          <View className="mt-3 rounded-sm bg-pos-danger-muted p-3">
            <Text className="text-pos-sm text-pos-danger">{error}</Text>
          </View>
        )}
      </View>

      {activeShift ? (
        <View className="mt-4 rounded-sm border border-pos-success/30 bg-pos-success-muted p-5">
          <Text className="text-pos-lg font-semibold text-pos-success">Active Shift</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">
            Opened: <Text className="font-mono">{formatTimestamp(activeShift.opened_at)}</Text>
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Opening Cash: <Text className="font-mono">{formatIDR(activeShift.opening_cash)}</Text>
          </Text>

          <PermissionGate permission={PERMISSION.CASH_MANAGEMENT}>
            <Button
              className="mt-4 items-center justify-center rounded-sm border border-accent bg-accent-muted p-4"
              onPress={() => router.push('/(app)/cash')}>
              <View className="flex-row items-center justify-center gap-2">
                <Banknote size={16} color={ThemeColors.accent.primary} />
                <Text className="text-pos-base font-semibold text-accent">Manage Cash</Text>
              </View>
            </Button>
          </PermissionGate>

          <Text className="mt-4 text-pos-sm font-semibold text-pos-text">Closing Cash Input</Text>
          <View className="mt-2 rounded-sm border border-border bg-surface px-4 py-3">
            <Text className="font-mono text-pos-xl font-bold text-accent">{formatIDR(closingAmount)}</Text>
          </View>

          {summary && closingInput.length > 0 && (
            <View className="mt-3 rounded-sm border border-border bg-surface p-4">
              <Text className="text-pos-sm text-pos-text-muted">Expected: <Text className="font-mono">{formatIDR(summary.expectedCash)}</Text></Text>
              <Text className="mt-1 text-pos-sm text-pos-text-muted">Actual: <Text className="font-mono">{formatIDR(closingAmount)}</Text></Text>
              <Text
                className={`mt-1 text-pos-sm font-semibold ${
                  previewDifference >= 0 ? 'text-pos-success' : 'text-pos-danger'
                }`}>
                Difference: <Text className="font-mono">{formatIDR(previewDifference)}</Text>
              </Text>
            </View>
          )}

          <View className="mt-4 flex-row flex-wrap justify-between">
            {keypad.map((key) => (
              <Pressable
                key={`close-${key}`}
                className="mb-3 h-14 w-[31%] items-center justify-center rounded-sm border border-border bg-surface-card"
                disabled={submitting}
                onPress={() => applyKey(key, closingInput, setClosingInput)}>
                <Text className="text-pos-lg font-semibold text-pos-text">{key}</Text>
              </Pressable>
            ))}
          </View>

          <PermissionGate permission={PERMISSION.MANAGE_SHIFT}>
            <Button
              className="mt-2 items-center justify-center rounded-sm border border-pos-danger/30 bg-pos-danger-muted p-4"
              disabled={submitting || closingInput.length === 0}
              onPress={onCloseShift}>
              <Text className="text-center text-pos-base font-semibold text-pos-danger">
                {submitting ? 'Closing Shift...' : 'Close Shift'}
              </Text>
            </Button>
          </PermissionGate>
        </View>
      ) : (
        <PermissionGate permission={PERMISSION.MANAGE_SHIFT}>
          <View className="mt-4 rounded-sm border border-border bg-surface-card p-5">
            <Text className="text-pos-lg font-semibold text-pos-text">Open New Shift</Text>
            <Text className="mt-2 text-pos-sm text-pos-text-muted">Enter opening cash amount</Text>

            <View className="mt-3 rounded-sm border border-border bg-surface px-4 py-3">
              <Text className="font-mono text-pos-xl font-bold text-accent">{formatIDR(openingAmount)}</Text>
            </View>

            <View className="mt-4 flex-row flex-wrap justify-between">
              {keypad.map((key) => (
                <Pressable
                  key={`open-${key}`}
                  className="mb-3 h-14 w-[31%] items-center justify-center rounded-sm border border-border bg-surface-card"
                  disabled={submitting}
                  onPress={() => applyKey(key, openingInput, setOpeningInput)}>
                  <Text className="text-pos-lg font-semibold text-pos-text">{key}</Text>
                </Pressable>
              ))}
            </View>

            <Button
              className="items-center justify-center rounded-sm bg-accent p-4"
              disabled={submitting || openingInput.length === 0}
              onPress={onOpenShift}>
              <Text className="text-center text-pos-base font-semibold text-white">
                {submitting ? 'Opening Shift...' : 'Open Shift'}
              </Text>
            </Button>
          </View>
        </PermissionGate>
      )}

      {lastClosedShift && (
        <View className="mt-4 rounded-sm border border-accent/30 bg-accent-muted p-5">
          <Text className="text-pos-base font-semibold text-accent">Last Closed Shift Summary</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">Closed: <Text className="font-mono">{formatTimestamp(lastClosedShift.closed_at)}</Text></Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Opening: <Text className="font-mono">{formatIDR(lastClosedShift.opening_cash)}</Text>
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Closing: <Text className="font-mono">{formatIDR(lastClosedShift.closing_cash ?? 0)}</Text>
          </Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Expected: <Text className="font-mono">{formatIDR(lastClosedShift.expected_cash ?? 0)}</Text>
          </Text>
          <Text
            className={`mt-1 text-pos-sm font-semibold ${
              (lastClosedShift.cash_difference ?? 0) >= 0 ? 'text-pos-success' : 'text-pos-danger'
            }`}>
            Difference: <Text className="font-mono">{formatIDR(lastClosedShift.cash_difference ?? 0)}</Text>
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
