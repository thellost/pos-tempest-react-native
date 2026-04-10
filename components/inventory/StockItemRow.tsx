import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import type { InventoryItem } from '@/hooks/use-inventory';

import { formatQty } from './shared';

export interface StockItemRowProps {
  item: InventoryItem;
  onPress: () => void;
}

export function StockItemRow({ item, onPress }: StockItemRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-sm border border-border bg-surface-card px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-pos-base font-semibold text-pos-text">{item.name}</Text>
        <Text className="text-pos-xs font-mono text-pos-text-faint">{item.unit_of_measure}</Text>
      </View>

      <View className="items-end gap-1">
        <Text className="font-mono text-pos-lg font-bold text-pos-text">{formatQty(item.stock_quantity)}</Text>
        <Text className="text-pos-xs text-pos-text-faint">
          threshold: {formatQty(item.low_stock_threshold)}
        </Text>
      </View>

      {item.is_low_stock && (
        <View className="rounded-sm px-2 py-1" style={{ backgroundColor: ThemeColors.danger.badge }}>
          <Text className="text-pos-xs font-bold" style={{ color: ThemeColors.danger.DEFAULT }}>Low</Text>
        </View>
      )}

      <ChevronRight size={16} color={ThemeColors.text.faint} />
    </Pressable>
  );
}
