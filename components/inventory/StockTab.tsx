import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AlertTriangle, Package } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import type { InventoryItem } from '@/hooks/use-inventory';
import { useInventory } from '@/hooks/use-inventory';

import { EmptyState, SectionHeader } from './shared';
import { StockDetailModal } from './StockDetailModal';
import { StockItemRow } from './StockItemRow';

// ─── StockTab ─────────────────────────────────────────────────────────────────

export function StockTab() {
  const { items, isLoading, error, fetchInventory, adjustStock, updateThreshold, getMovements } = useInventory();
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const filtered = items.filter((i) => {
    if (lowOnly && !i.is_low_stock) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <View className="flex-1">
      <SectionHeader title="Stock Levels" onRefresh={fetchInventory} refreshing={isLoading} />

      <View className="flex-row items-center gap-2 border-b border-border bg-surface-card px-4 py-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search ingredient name..."
          placeholderTextColor={ThemeColors.text.faint}
          className="flex-1 rounded-sm border border-border bg-surface-raised px-3 text-pos-sm text-pos-text"
          style={{ height: 36 }}
        />
        <Pressable
          onPress={() => setLowOnly((v) => !v)}
          className="flex-row items-center gap-1 rounded-sm px-3"
          style={{
            height: 36,
            backgroundColor: lowOnly ? ThemeColors.danger.badge : ThemeColors.surfaces.raised,
          }}
        >
          <AlertTriangle size={13} color={lowOnly ? ThemeColors.danger.DEFAULT : ThemeColors.text.muted} />
          <Text
            className="text-pos-xs font-bold"
            style={{ color: lowOnly ? ThemeColors.danger.DEFAULT : ThemeColors.text.muted }}
          >
            Low Stock
          </Text>
        </Pressable>
      </View>

      {isLoading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-pos-base text-pos-text-muted">{error}</Text>
          <Pressable onPress={fetchInventory} className="mt-4 rounded-sm px-4 py-2" style={{ backgroundColor: ThemeColors.accent.primaryMuted }}>
            <Text className="text-pos-sm font-bold" style={{ color: ThemeColors.accent.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 6 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <EmptyState icon={<Package size={32} color={ThemeColors.text.muted} />} message="No inventory items" />
          ) : (
            filtered.map((item) => (
              <StockItemRow key={item.id} item={item} onPress={() => setSelected(item)} />
            ))
          )}
        </ScrollView>
      )}

      <StockDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onAdjust={async (id, qty, type, reason) => {
          await adjustStock({ inventory_id: id, quantity_change: qty, movement_type: type, reason });
        }}
        onThreshold={updateThreshold}
        getMovements={getMovements}
      />
    </View>
  );
}
