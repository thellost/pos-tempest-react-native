import { Button } from '@/components/ui';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { PERMISSION } from '@/constants/permissions';
import { ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { useShift } from '@/hooks/use-shift';
import { formatIDR } from '@/utils/currency';
import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { Banknote } from 'lucide-react-native';
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

type RecentShiftRow = {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  notes: string | null;
};

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'strong' }) {
  return (
    <View className="mt-1 flex-row items-center justify-between">
      <Text className="text-pos-sm text-pos-text-muted">{label}</Text>
      <Text
        className={`font-mono ${tone === 'strong' ? 'text-pos-base font-bold text-pos-text' : 'text-pos-sm text-pos-text'}`}>
        {value}
      </Text>
    </View>
  );
}

export default function ShiftsScreen() {
  const { user } = useAuth();
  const { registration } = useDevice();
  const { activeShift, summary, loading, error, autoShiftEnabled } = useShift();

  const branch = registration?.branch ?? null;
  const branchId = branch?.id ?? null;

  const { data: recentShifts = [] } = useQuery<RecentShiftRow>(
    `SELECT id, opened_at, closed_at, opening_cash, closing_cash, expected_cash, cash_difference, notes
     FROM shifts
     WHERE branch_id = ? AND status = 'closed'
     ORDER BY closed_at DESC
     LIMIT 10`,
    [branchId ?? -1],
  );

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Header card */}
      <View className="rounded-sm border border-border bg-surface-card p-5">
        <Text className="text-pos-2xl font-bold text-pos-text">Cash Management</Text>
        <Text className="mt-2 text-pos-sm text-pos-text-muted">
          {user?.name ?? 'User'} · Branch {branch?.name ?? '-'}
        </Text>

        {loading && (
          <View className="mt-3 flex-row items-center gap-2">
            <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
            <Text className="text-pos-sm text-pos-text-muted">Loading shift state...</Text>
          </View>
        )}

        {error && (
          <View className="mt-3 rounded-sm bg-pos-danger-muted p-3">
            <Text className="text-pos-sm text-pos-danger">{error}</Text>
          </View>
        )}
      </View>

      {/* Today's Shift card */}
      <Text className="mt-5 text-pos-base font-semibold text-pos-text">Today&apos;s Shift</Text>

      {activeShift ? (
        <View className="mt-2 rounded-sm border border-pos-success/30 bg-pos-success-muted p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-pos-lg font-semibold text-pos-success">Active Shift</Text>
            <View className="rounded-full border border-pos-success/40 bg-pos-success/10 px-2.5 py-0.5">
              <Text className="text-pos-xs font-semibold text-pos-success">Auto-Open</Text>
            </View>
          </View>

          <Text className="mt-3 text-pos-sm text-pos-text-muted">
            Opened at: <Text className="font-mono text-pos-text">{formatTimestamp(activeShift.opened_at)}</Text>
          </Text>

          {summary && (
            <View className="mt-4 rounded-sm border border-border bg-surface p-4">
              <SummaryRow label="Net Cash Sales" value={formatIDR(summary.netCashSales)} />
              <SummaryRow label="Cash In" value={formatIDR(summary.totalCashIn)} />
              <SummaryRow label="Cash Out" value={formatIDR(summary.totalCashOut)} />
              <View className="mt-2 border-t border-border pt-2">
                <SummaryRow label="Expected Cash" value={formatIDR(summary.expectedCash)} tone="strong" />
              </View>
            </View>
          )}

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
        </View>
      ) : autoShiftEnabled === false ? (
        <View className="mt-2 rounded-sm border border-border bg-surface-card p-5">
          <Text className="text-pos-lg font-semibold text-pos-text">Auto-shift disabled</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">
            Auto-shift is disabled for this branch. Enable it in Settings to start automatic shift management.
          </Text>
        </View>
      ) : (
        <View className="mt-2 rounded-sm border border-accent/30 bg-accent-muted p-5">
          <Text className="text-pos-lg font-semibold text-accent">No shift open</Text>
          <Text className="mt-2 text-pos-sm text-pos-text-muted">
            No shift open right now. The branch is outside operating hours, or the scheduler hasn&apos;t opened today&apos;s
            shift yet.
          </Text>
          <Text className="mt-3 text-pos-xs text-pos-text-muted">
            {branch?.opening_time && branch?.closing_time ? (
              <>
                Operating hours:{' '}
                <Text className="font-mono text-pos-text">
                  {branch.opening_time} – {branch.closing_time}
                </Text>{' '}
                ({branch.timezone ?? 'Asia/Jakarta'})
              </>
            ) : (
              'Schedule not configured'
            )}
          </Text>
        </View>
      )}

      {/* Recent Shifts */}
      <Text className="mt-6 text-pos-base font-semibold text-pos-text">Recent Shifts</Text>

      {recentShifts.length === 0 ? (
        <View className="mt-2 rounded-sm border border-border bg-surface-card p-5">
          <Text className="text-pos-sm text-pos-text-muted">No previous shifts.</Text>
        </View>
      ) : (
        <View className="mt-2 overflow-hidden rounded-sm border border-border bg-surface-card">
          {recentShifts.map((shift, index) => {
            const isAuto = (shift.notes ?? '').toLowerCase().includes('auto-closed');
            const diff = shift.cash_difference;
            const diffText = diff === null ? '—' : formatIDR(diff);
            const diffColor =
              diff === null
                ? 'text-pos-text-muted'
                : diff >= 0
                  ? 'text-pos-success'
                  : 'text-pos-danger';

            return (
              <View
                key={shift.id}
                className={`p-4 ${index > 0 ? 'border-t border-border' : ''}`}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-pos-sm text-pos-text">
                    {formatTimestamp(shift.opened_at)} → {formatTimestamp(shift.closed_at)}
                  </Text>
                  {isAuto && (
                    <View className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
                      <Text className="text-pos-xs font-semibold text-accent">auto</Text>
                    </View>
                  )}
                </View>

                <View className="mt-2 flex-row flex-wrap items-center justify-between gap-y-1">
                  <Text className="text-pos-xs text-pos-text-muted">
                    Expected:{' '}
                    <Text className="font-mono text-pos-text">
                      {shift.expected_cash === null ? '—' : formatIDR(shift.expected_cash)}
                    </Text>
                  </Text>
                  <Text className="text-pos-xs text-pos-text-muted">
                    Closing:{' '}
                    <Text className="font-mono text-pos-text">
                      {shift.closing_cash === null ? '—' : formatIDR(shift.closing_cash)}
                    </Text>
                  </Text>
                  <Text className={`text-pos-xs font-semibold ${diffColor}`}>
                    Diff: <Text className="font-mono">{diffText}</Text>
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
