import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

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

  const activeStyle = quantity > 0
    ? { borderColor: accentColor + '99' }  // accent at ~60% opacity when in cart
    : undefined;

  return (
    <View
      className={`overflow-hidden rounded-sm border border-border bg-surface-card flex-row ${!isAvailable ? 'opacity-50' : ''}`}
      style={[{ minHeight: 72 }, activeStyle]}
    >
      {/* Left accent bar */}
      <View className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: accentColor }} />

      {/* Content area — the whole left side is the "add" press target */}
      <Pressable
        onPress={handleAdd}
        disabled={!isAvailable}
        className="flex-1 justify-between pl-3 pr-1.5 pb-2 pt-2 active:opacity-70"
      >
        <Text className="text-[9px] uppercase tracking-widest text-pos-text-faint" numberOfLines={1}>
          {displayCategory}
        </Text>
        <Text className="mt-0.5 text-[12px] font-semibold leading-[15px] text-pos-text" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="mt-1 font-mono text-[11px] font-bold text-pos-text" numberOfLines={1}>
          {formatIDR(item.price)}
          {isWeightBased && (
            <Text className="text-[10px] font-normal text-pos-text-faint">/{item.unit_of_measure}</Text>
          )}
        </Text>

        {/* LOW STOCK badge */}
        {isLowStock && isAvailable && (
          <View className="absolute right-1 top-1 rounded bg-pos-warning px-1 py-px">
            <Text className="text-[7px] font-bold uppercase text-pos-text-strong">low</Text>
          </View>
        )}
        {/* SOLD OUT badge */}
        {!isAvailable && (
          <View className="absolute bottom-1 right-1 rounded bg-pos-danger px-1 py-px">
            <Text className="text-[7px] font-bold uppercase text-pos-text-strong">sold</Text>
          </View>
        )}
      </Pressable>

      {/* Right panel — separate from the add Pressable so decrement works reliably */}
      {quantity > 0 ? (
        /* Entire panel = decrement press target → max touch area, no nested conflict */
        <Pressable
          onPress={handleDecrement}
          disabled={!isAvailable}
          className="w-9 items-center justify-between py-2 active:opacity-50"
          style={{ borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)' }}
        >
          <Text
            className="text-[14px] font-bold leading-none"
            style={{ color: accentColor }}
          >
            {quantity > 9 ? '9+' : quantity}
          </Text>
          <Text className="text-[20px] font-bold leading-none text-pos-danger">−</Text>
        </Pressable>
      ) : (
        /* Faint + hint: tapping the right side also adds */
        <Pressable
          onPress={handleAdd}
          disabled={!isAvailable}
          className="w-9 items-center justify-center active:opacity-50"
          style={{ borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)' }}
        >
          <Text className="text-[18px] font-medium leading-none text-pos-text-muted">+</Text>
        </Pressable>
      )}
    </View>
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
