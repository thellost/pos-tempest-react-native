import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { KOTCard } from '@/components/kitchen/KOTCard';
import type { KotStatus } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import type { KOTRow } from '@/hooks/use-kitchen';
import { useKitchen } from '@/hooks/use-kitchen';

// ─── Column header ────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  label: string;
  count: number;
  accentColor: string;
}

function ColumnHeader({ label, count, accentColor }: ColumnHeaderProps) {
  return (
    <View
      className="flex-row items-center justify-between border-b border-border px-4 py-3"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      <Text className="text-pos-base font-bold text-pos-text">{label}</Text>
      <View
        className="min-w-[28px] items-center justify-center rounded-full px-2 py-0.5"
        style={{ backgroundColor: accentColor + '33' }}
      >
        <Text
          className="text-pos-xs font-bold"
          style={{ color: accentColor }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}

// ─── KDS column ───────────────────────────────────────────────────────────────

interface KDSColumnProps {
  label: string;
  accentColor: string;
  kots: KOTRow[];
  onAdvance: (kotId: number, currentStatus: KotStatus) => Promise<void>;
  emptyMessage: string;
}

function KDSColumn({
  label,
  accentColor,
  kots,
  onAdvance,
  emptyMessage,
}: KDSColumnProps) {
  return (
    <View
      className="flex-1 border-r border-border bg-surface"
      style={{ minWidth: 0 }}
    >
      <ColumnHeader label={label} count={kots.length} accentColor={accentColor} />

      <ScrollView
        contentContainerStyle={{ padding: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {kots.length === 0 ? (
          <View className="items-center py-10">
            <Text className="text-2xl mb-2">
              {label === 'Pending' ? '⏳' : label === 'In Progress' ? '🍳' : '✅'}
            </Text>
            <Text className="text-pos-sm text-pos-text-faint text-center">
              {emptyMessage}
            </Text>
          </View>
        ) : (
          kots.map((kot) => (
            <KOTCard key={String(kot.id)} kot={kot} onAdvance={onAdvance} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Kitchen screen ───────────────────────────────────────────────────────────

/**
 * Kitchen Display System — 3-column Kanban board.
 * Pending → In Progress → Ready
 * Each KOT card shows items, round badge, elapsed time, and an advance button.
 */
export default function KitchenScreen() {
  const { pendingKOTs, inProgressKOTs, readyKOTs, isLoading, advanceKOT } =
    useKitchen();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        <Text className="mt-4 text-pos-base text-pos-text-muted">
          Loading kitchen display…
        </Text>
      </View>
    );
  }

  const totalActive =
    pendingKOTs.length + inProgressKOTs.length + readyKOTs.length;

  return (
    <View className="flex-1 flex-col bg-surface">
      {/* ── Top bar ── */}
      <View className="border-b border-border bg-surface-card px-5 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Text className="text-pos-2xl font-bold text-pos-text">
            🍳 Kitchen Display
          </Text>
          {totalActive > 0 && (
            <View className="rounded-full bg-brand px-3 py-0.5">
              <Text className="text-pos-xs font-bold text-white">
                {totalActive} active
              </Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View className="flex-row items-center gap-4">
          {[
            { dot: ThemeColors.warning.DEFAULT, label: 'Pending' },
            { dot: ThemeColors.info.DEFAULT, label: 'In Progress' },
            { dot: ThemeColors.success.DEFAULT, label: 'Ready' },
          ].map(({ dot, label }) => (
            <View key={label} className="flex-row items-center gap-1.5">
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: dot }}
              />
              <Text className="text-pos-xs text-pos-text-muted">{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Kanban columns ── */}
      <View className="flex-1 flex-row">
        <KDSColumn
          label="Pending"
          accentColor={ThemeColors.warning.DEFAULT}
          kots={pendingKOTs}
          onAdvance={advanceKOT}
          emptyMessage="No tickets waiting"
        />
        <KDSColumn
          label="In Progress"
          accentColor={ThemeColors.info.DEFAULT}
          kots={inProgressKOTs}
          onAdvance={advanceKOT}
          emptyMessage="Nothing cooking right now"
        />
        <KDSColumn
          label="Ready"
          accentColor={ThemeColors.success.DEFAULT}
          kots={readyKOTs}
          onAdvance={advanceKOT}
          emptyMessage="Nothing ready to serve"
        />
      </View>
    </View>
  );
}
