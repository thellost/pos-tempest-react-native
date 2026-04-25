import { ThemeColors } from '@/constants/theme';
import { CheckCircle, ChefHat, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactElement } from 'react';

import { KOTCard } from '@/components/kitchen/KOTCard';
import type { KotStatus } from '@/constants/enums';
import type { KOTRow } from '@/hooks/use-kitchen';
import { useKitchen } from '@/hooks/use-kitchen';
import { useLayout } from '@/hooks/use-layout';

// ─── Column header ────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  label: string;
  count: number;
  accentColor: string;
}

function ColumnHeader({ label, count, accentColor }: ColumnHeaderProps) {
  return (
    <View
      className="flex-row items-center justify-between border-b border-border px-3 py-2"
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
    >
      <Text className="text-pos-base font-bold text-pos-text">{label}</Text>
      <View
        className="min-w-[28px] items-center justify-center rounded px-2 py-0.5"
        style={{ backgroundColor: accentColor + '33' }}
      >
        <Text
          className="font-mono text-pos-xs font-bold"
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
  onAdvance: (kotId: string, currentStatus: KotStatus) => Promise<void>;
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
        contentContainerStyle={{ padding: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {kots.length === 0 ? (
          <View className="items-center py-10">
            <View className="mb-2">
              {label === 'Pending'
                ? <Clock size={28} color={ThemeColors.text.faint} />
                : label === 'In Progress'
                  ? <ChefHat size={28} color={ThemeColors.text.faint} />
                  : <CheckCircle size={28} color={ThemeColors.text.faint} />}
            </View>
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

// ─── Phone tab bar ────────────────────────────────────────────────────────────

type TabKey = 'pending' | 'preparing' | 'ready';

interface PhoneTabBarProps {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
}

function PhoneTabBar({
  activeTab,
  onSelect,
  pendingCount,
  preparingCount,
  readyCount,
}: PhoneTabBarProps) {
  const tabs: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: 'pending', label: 'Pending', count: pendingCount, color: ThemeColors.warning.DEFAULT },
    { key: 'preparing', label: 'Preparing', count: preparingCount, color: ThemeColors.info.DEFAULT },
    { key: 'ready', label: 'Ready', count: readyCount, color: ThemeColors.success.DEFAULT },
  ];

  return (
    <View className="flex-row border-b border-border bg-surface-card">
      {tabs.map(({ key, label, count, color }) => {
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            className="flex-1 items-center py-3"
            style={isActive ? { borderBottomWidth: 2, borderBottomColor: color } : undefined}
          >
            <View className="flex-row items-center gap-1.5">
              <Text
                className="text-pos-sm font-semibold"
                style={{ color: isActive ? color : ThemeColors.text.muted }}
              >
                {label}
              </Text>
              <View
                className="min-w-[18px] items-center justify-center rounded px-1"
                style={{ backgroundColor: isActive ? color + '33' : ThemeColors.surfaces.raised }}
              >
                <Text
                  className="font-mono font-bold"
                  style={{ fontSize: 10, color: isActive ? color : ThemeColors.text.muted }}
                >
                  {count}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Kitchen screen ───────────────────────────────────────────────────────────

/**
 * Kitchen Display System.
 * Tablet: 3-column Kanban board (Pending → In Progress → Ready).
 * Phone: tab-based single-column view with full-width KOT cards.
 */
export default function KitchenScreen() {
  const { pendingKOTs, inProgressKOTs, readyKOTs, isLoading, advanceKOT } =
    useKitchen();
  const { isPhone } = useLayout();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');

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

  const activeKOTs: KOTRow[] =
    activeTab === 'pending'
      ? pendingKOTs
      : activeTab === 'preparing'
        ? inProgressKOTs
        : readyKOTs;

  const emptyMessages: Record<TabKey, string> = {
    pending: 'No tickets waiting',
    preparing: 'Nothing cooking right now',
    ready: 'Nothing ready to serve',
  };

  const emptyIcons: Record<TabKey, ReactElement> = {
    pending: <Clock size={28} color={ThemeColors.text.faint} />,
    preparing: <ChefHat size={28} color={ThemeColors.text.faint} />,
    ready: <CheckCircle size={28} color={ThemeColors.text.faint} />,
  };

  return (
    <View className="flex-1 flex-col bg-surface">
      {/* ── Top bar ── */}
      <View className="border-b border-border bg-surface-card px-4 py-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-2">
            <ChefHat size={22} color={ThemeColors.text.primary} />
            <Text className="text-pos-2xl font-bold text-pos-text">Kitchen Display</Text>
          </View>
          {totalActive > 0 && (
            <View className="rounded px-3 py-0.5 bg-brand">
              <Text className="font-mono text-pos-xs font-bold text-white">
                {totalActive} active
              </Text>
            </View>
          )}
        </View>

        {/* Legend — hidden on phone (tabs serve as legend) */}
        {!isPhone && (
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
        )}
      </View>

      {isPhone ? (
        /* ── Phone: tab-based layout ── */
        <>
          <PhoneTabBar
            activeTab={activeTab}
            onSelect={setActiveTab}
            pendingCount={pendingKOTs.length}
            preparingCount={inProgressKOTs.length}
            readyCount={readyKOTs.length}
          />
          <ScrollView
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {activeKOTs.length === 0 ? (
              <View className="items-center py-10">
                <View className="mb-2">{emptyIcons[activeTab]}</View>
                <Text className="text-pos-sm text-pos-text-faint text-center">
                  {emptyMessages[activeTab]}
                </Text>
              </View>
            ) : (
              activeKOTs.map((kot) => (
                <KOTCard key={String(kot.id)} kot={kot} onAdvance={advanceKOT} />
              ))
            )}
          </ScrollView>
        </>
      ) : (
        /* ── Tablet: 3-column Kanban ── */
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
      )}
    </View>
  );
}
