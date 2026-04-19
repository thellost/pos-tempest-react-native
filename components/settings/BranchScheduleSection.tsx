import { Text, View } from 'react-native';

import type { Branch } from '@/db/models';
import { InfoRow, RowDivider } from './primitives';

interface BranchScheduleSectionProps {
  branch: Branch | null;
}

export function BranchScheduleSection({ branch }: BranchScheduleSectionProps) {
  if (!branch) {
    return (
      <View className="items-center py-4">
        <Text className="text-pos-xs text-pos-text-faint">No branch registered on this device.</Text>
      </View>
    );
  }

  const openingTime = branch.opening_time ?? '08:00';
  const closingTime = branch.closing_time ?? '22:00';

  return (
    <View className="gap-3">
      {/* Branch name */}
      <View className="overflow-hidden rounded-xl border border-border bg-surface">
        <InfoRow label="Branch" value={branch.name} />
      </View>

      {/* Schedule (read-only) */}
      <View className="overflow-hidden rounded-xl border border-border bg-surface">
        <View className="px-3.5 pb-1.5 pt-3">
          <Text className="text-pos-xs font-semibold uppercase tracking-widest text-pos-text-faint">
            Schedule
          </Text>
          <Text className="mt-0.5 text-pos-xs text-pos-text-faint" numberOfLines={1}>
            Times are in {branch.timezone || 'Asia/Jakarta'} · Manage on web dashboard
          </Text>
        </View>

        {/* Auto-shift status */}
        <RowDivider />
        <View className="flex-row items-center justify-between px-3.5 py-2.5">
          <View className="flex-1">
            <Text className="text-pos-xs font-medium text-pos-text">Auto-shift</Text>
            <Text className="mt-0.5 text-pos-xs text-pos-text-faint">
              Scheduler opens &amp; closes shifts automatically
            </Text>
          </View>
          <View className="rounded-lg border border-border bg-surface-raised px-3 py-1">
            <Text className="text-pos-xs font-semibold text-pos-text">
              {branch.auto_shift ? 'On' : 'Off'}
            </Text>
          </View>
        </View>

        {/* Opening time */}
        <RowDivider />
        <View className="flex-row items-center justify-between px-3.5 py-2.5">
          <Text className="text-pos-xs font-medium text-pos-text">Opening time</Text>
          <Text className="min-w-[72px] rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-center text-pos-xs font-medium text-pos-text">
            {openingTime}
          </Text>
        </View>

        {/* Closing time */}
        <RowDivider />
        <View className="flex-row items-center justify-between px-3.5 py-2.5">
          <Text className="text-pos-xs font-medium text-pos-text">Closing time</Text>
          <Text className="min-w-[72px] rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-center text-pos-xs font-medium text-pos-text">
            {closingTime}
          </Text>
        </View>
      </View>
    </View>
  );
}
