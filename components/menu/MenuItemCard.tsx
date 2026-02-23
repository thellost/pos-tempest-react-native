import { Pressable, Text, View } from 'react-native';

import { PRICING_TYPE } from '@/constants/enums';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';

const DEFAULT_BUTTON_COLOR = '#475569';

interface MenuItemCardProps {
  item: MenuItemWithInventory;
  categoryColor?: string | null;
  categoryName?: string | null;
  quantity?: number;
  onPressItem: (item: MenuItemWithInventory) => void;
  onDecrementItem?: (item: MenuItemWithInventory) => void;
}

export function MenuItemCard({ 
  item, 
  categoryColor, 
  categoryName,
  quantity = 0, 
  onPressItem, 
  onDecrementItem 
}: MenuItemCardProps) {
  const isWeightBased = item.pricing_type === PRICING_TYPE.WEIGHT_BASED;
  const isAvailable = Boolean(item.is_available);
  const isLowStock = item.isLowStock;
  const accentColor = categoryColor || DEFAULT_BUTTON_COLOR;
  const displayCategory = categoryName || 'Food & Drink';

  const handleAdd = () => {
    if (isAvailable) {
      onPressItem(item);
    }
  };

  const handleDecrement = () => {
    if (!isAvailable || !onDecrementItem || quantity <= 0) return;
    onDecrementItem(item);
  };

  return (
    <View
      className={`overflow-hidden border border-border bg-surface-card ${!isAvailable ? 'opacity-50' : ''}`}
      style={{ minHeight: 100, borderRadius: 6 }}
    >
      <View className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: accentColor }} />

      <Pressable 
        onPress={handleAdd} 
        disabled={!isAvailable} 
        className="flex-1 px-3 pb-1.5 pt-2 active:opacity-70"
      >
        <Text className="text-[10px] text-pos-text-faint" numberOfLines={1}>
          {displayCategory}
        </Text>

        <View className="mt-0.5 flex-1 justify-between">
          <Text className="text-[13px] font-semibold leading-4 text-pos-text" numberOfLines={2}>
            {item.name}
          </Text>

          <Text className="mt-1 text-[12px] font-semibold text-pos-text">
            {formatIDR(item.price)}
            {isWeightBased && `/${item.unit_of_measure}`}
          </Text>
        </View>
      </Pressable>

      <View className="flex-row items-center justify-end gap-1.5 border-t border-border px-2 py-1.5">
        <Pressable
          onPress={handleDecrement}
          disabled={!isAvailable || quantity <= 0}
          className="h-6 w-6 items-center justify-center rounded border border-border bg-surface-raised active:opacity-60"
        >
          <Text className="text-[12px] text-pos-text">−</Text>
        </Pressable>

        <Text className="w-4 text-center text-[12px] font-semibold text-pos-text">
          {quantity}
        </Text>

        <Pressable
          onPress={handleAdd}
          disabled={!isAvailable}
          className="h-6 w-6 items-center justify-center rounded border border-border bg-surface-raised active:opacity-60"
        >
          <Text className="text-[12px] text-pos-text">+</Text>
        </Pressable>
      </View>

      {isLowStock && isAvailable && (
        <View className="absolute right-1.5 top-1.5 rounded bg-pos-warning px-1.5 py-0.5">
          <Text className="text-[8px] font-bold text-pos-text-strong">LOW</Text>
        </View>
      )}

      {!isAvailable && (
        <View className="absolute right-1.5 top-1.5 rounded bg-pos-danger px-1.5 py-0.5">
          <Text className="text-[8px] font-bold text-pos-text-strong">SOLD</Text>
        </View>
      )}
    </View>
  );
}
