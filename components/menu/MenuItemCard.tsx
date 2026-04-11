import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { IconButton } from '@/components/ui';

import { PRICING_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';

const DEFAULT_BUTTON_COLOR = ThemeColors.category.default;

interface MenuItemCardProps {
  item: MenuItemWithInventory;
  categoryColor?: string | null;
  categoryName?: string | null;
  quantity?: number;
  onPressItem: (item: MenuItemWithInventory) => void;
  onDecrementItem?: (item: MenuItemWithInventory) => void;
}

function MenuItemCardComponent({ 
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

  const handleAdd = useCallback(() => {
    if (isAvailable) {
      onPressItem(item);
    }
  }, [isAvailable, onPressItem, item]);

  const handleDecrement = useCallback(() => {
    if (!isAvailable || !onDecrementItem || quantity <= 0) return;
    onDecrementItem(item);
  }, [isAvailable, onDecrementItem, quantity, item]);

  return (
    <Pressable
      onPress={handleAdd}
      disabled={!isAvailable}
      className={`overflow-hidden rounded-sm border border-border bg-surface-card active:opacity-70 ${!isAvailable ? 'opacity-50' : ''}`}
      style={{ minHeight: 80 }}
    >
      <View className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: accentColor }} />

      <View className="flex-1 px-3 pb-1.5 pt-2">
        <Text className="text-[10px] text-pos-text-faint" numberOfLines={1}>
          {displayCategory}
        </Text>

        <View className="mt-0.5 flex-1 justify-between">
          <Text className="text-[13px] font-semibold leading-4 text-pos-text" numberOfLines={2}>
            {item.name}
          </Text>

          <Text className="mt-1 font-mono text-[12px] font-semibold text-pos-text">
            {formatIDR(item.price)}
            {isWeightBased && `/${item.unit_of_measure}`}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-end border-t border-border px-2 py-1">
        {quantity > 0 ? (
          <View className="flex-row items-center gap-1.5">
            <IconButton
              size="sm"
              onPress={handleDecrement}
              disabled={!isAvailable || quantity <= 0}
              className="border border-border bg-surface-raised"
            >
              <Text className="text-[12px] text-pos-text">−</Text>
            </IconButton>
            <Text className="w-5 text-center text-[12px] font-semibold text-pos-text">
              {quantity}
            </Text>
          </View>
        ) : (
          <Text className="text-[10px] text-pos-text-faint">tap to add</Text>
        )}
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
    </Pressable>
  );
}

function areMenuItemCardPropsEqual(prev: MenuItemCardProps, next: MenuItemCardProps): boolean {
  return (
    prev.item.id === next.item.id &&
    prev.item.name === next.item.name &&
    prev.item.price === next.item.price &&
    prev.item.pricing_type === next.item.pricing_type &&
    prev.item.unit_of_measure === next.item.unit_of_measure &&
    prev.item.is_available === next.item.is_available &&
    prev.item.isLowStock === next.item.isLowStock &&
    prev.categoryColor === next.categoryColor &&
    prev.categoryName === next.categoryName &&
    prev.quantity === next.quantity &&
    prev.onPressItem === next.onPressItem &&
    prev.onDecrementItem === next.onDecrementItem
  );
}

export const MenuItemCard = memo(MenuItemCardComponent, areMenuItemCardPropsEqual);
