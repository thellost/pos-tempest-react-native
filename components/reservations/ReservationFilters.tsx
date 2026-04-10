import { Pressable, ScrollView, Text, View } from 'react-native';

import type { ReservationStatus } from '@/constants/enums';

// ─── Types & Constants ────────────────────────────────────────────────────────

export type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';
export type StatusFilter = ReservationStatus | 'all';

export const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This Week',
  all: 'All',
};

export const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'seated', label: 'Seated' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ReservationFiltersProps {
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
}

export function ReservationFilters({
  dateFilter,
  setDateFilter,
  statusFilter,
  setStatusFilter,
}: ReservationFiltersProps) {
  return (
    <>
      {/* Date filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
        <View className="flex-row gap-2 px-1">
          {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setDateFilter(f)}
              className={`rounded-sm px-4 py-1.5 ${dateFilter === f ? 'bg-brand' : 'bg-surface-raised'}`}
            >
              <Text className={`text-pos-sm font-semibold ${dateFilter === f ? 'text-white' : 'text-pos-text-muted'}`}>
                {DATE_FILTER_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 -mx-1">
        <View className="flex-row gap-2 px-1">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setStatusFilter(opt.value)}
              className={`rounded-sm px-3 py-1 ${statusFilter === opt.value ? 'bg-surface-card border border-brand' : 'bg-surface-raised'}`}
            >
              <Text className={`text-pos-xs font-semibold ${statusFilter === opt.value ? 'text-brand' : 'text-pos-text-muted'}`}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
