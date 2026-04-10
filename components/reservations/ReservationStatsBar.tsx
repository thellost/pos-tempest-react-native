import { ScrollView, Text, View } from 'react-native';

// ─── StatChip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View className={`rounded-sm px-4 py-2 items-center min-w-[72px] ${bg}`}>
      <Text className={`font-mono text-pos-lg font-bold ${color}`}>{value}</Text>
      <Text className="text-pos-xs text-pos-text-muted">{label}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ReservationStatsBarProps {
  todayCount: number;
  confirmedCount: number;
  seatedCount: number;
  weekCount: number;
}

export function ReservationStatsBar({
  todayCount,
  confirmedCount,
  seatedCount,
  weekCount,
}: ReservationStatsBarProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 -mx-1">
      <View className="flex-row gap-2 px-1">
        <StatChip label="Today" value={todayCount} color="text-brand" bg="bg-brand/10" />
        <StatChip label="Confirmed" value={confirmedCount} color="text-brand" bg="bg-brand/10" />
        <StatChip label="Seated" value={seatedCount} color="text-status-available" bg="bg-status-available/10" />
        <StatChip label="This Week" value={weekCount} color="text-pos-text" bg="bg-surface-raised" />
      </View>
    </ScrollView>
  );
}
