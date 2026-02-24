import { useCallback, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Swipeable } from 'react-native-gesture-handler';

import { OrderItemBadge } from '@/components/order/OrderItemBadge';
import type { OrderItemDisplay } from '@/components/order/types';
import { formatIDR } from '@/utils/currency';

interface OrderItemRowProps {
  item: OrderItemDisplay;
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemove: (itemId: number) => void;
  onEditModifiers: (itemId: number) => void;
}

export function OrderItemRow({
  item,
  onUpdateQuantity,
  onRemove,
  onEditModifiers,
}: OrderItemRowProps) {
  const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
  const swipeableRef = useRef<Swipeable | null>(null);

  const displayQuantity = typeof item.quantity === 'string'
    ? parseInt(item.quantity as string, 10)
    : item.quantity;

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const rightActions = useMemo(() => (
    <Pressable
      onPress={() => {
        closeSwipeable();
        onRemove(itemId);
      }}
      className="h-full w-[72px] items-center justify-center bg-pos-danger"
    >
      <MaterialIcons name="delete" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Delete</Text>
    </Pressable>
  ), [itemId, onRemove, closeSwipeable]);

  const leftActions = useMemo(() => (
    <Pressable
      onPress={() => {
        closeSwipeable();
        onEditModifiers(itemId);
      }}
      className="h-full w-[72px] items-center justify-center bg-amber-500"
    >
      <MaterialIcons name="edit" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Edit</Text>
    </Pressable>
  ), [closeSwipeable, itemId, onEditModifiers]);

  return (
    <View className={item.is_voided ? 'opacity-50' : ''}>
      <Swipeable
        ref={(ref) => {
          swipeableRef.current = ref;
        }}
        renderLeftActions={() => (item.is_voided ? null : leftActions)}
        renderRightActions={() => (item.is_voided ? null : rightActions)}
        overshootLeft={false}
        overshootRight={false}
        leftThreshold={40}
        rightThreshold={40}
      >
        <Pressable
          onPress={() => onEditModifiers(itemId)}
          className="mb-1.5 overflow-hidden rounded-sm bg-surface-card px-2.5 py-2 active:opacity-90"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-1">
              <View className="flex-row items-center gap-1">
                <Text className="flex-1 text-pos-sm font-semibold text-pos-text" numberOfLines={1}>
                  {item.menu_item_name}
                </Text>
                {item.is_voided ? <OrderItemBadge variant="void" /> : null}
                {!item.is_voided && item.modifiers.length > 0 ? (
                  <OrderItemBadge variant="modifiers" count={item.modifiers.length} />
                ) : null}
              </View>

              {(item.modifiers.length > 0 || Boolean(item.notes)) && (
                <Text className="mt-0.5 text-[10px] text-pos-text-faint" numberOfLines={1}>
                  {item.modifiers.length > 0
                    ? item.modifiers.map((modifier) => modifier.modifier_name).join(', ')
                    : item.notes}
                </Text>
              )}
            </View>

            {!item.is_voided ? (
              <View className="ml-2 flex-row items-center gap-1.5">
                <Pressable
                  onPress={() => onEditModifiers(itemId)}
                  className="h-6 w-6 items-center justify-center rounded-full bg-amber-500/15"
                >
                  <MaterialIcons name="edit" size={14} color="#F59E0B" />
                </Pressable>

                <Text className="text-pos-sm font-bold text-accent">
                  {formatIDR(item.total)}
                </Text>
                <Pressable
                  onPress={() => {
                    closeSwipeable();
                    onRemove(itemId);
                  }}
                  className="h-6 w-6 items-center justify-center rounded-full bg-pos-danger-muted"
                >
                  <MaterialIcons name="delete" size={14} color="#ef4444" />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View className="mt-1.5 flex-row items-center justify-between">
            {!item.is_voided ? (
              <View className="flex-row items-center gap-1.5">
                <Pressable
                  onPress={() => onUpdateQuantity(itemId, displayQuantity - 1)}
                  className="h-5 w-5 items-center justify-center rounded-sm bg-surface-raised active:opacity-60"
                >
                  <Text className="text-[11px] text-pos-text">−</Text>
                </Pressable>
                <Text className="min-w-[14px] text-center text-[11px] font-semibold text-pos-text">
                  {displayQuantity}
                </Text>
                <Pressable
                  onPress={() => onUpdateQuantity(itemId, displayQuantity + 1)}
                  className="h-5 w-5 items-center justify-center rounded-sm bg-surface-raised active:opacity-60"
                >
                  <Text className="text-[11px] text-pos-text">+</Text>
                </Pressable>
              </View>
            ) : null}

            <View className="flex-1 items-end">
              <Text className="text-[10px] text-pos-text-faint">
                {formatIDR(item.unit_price + item.modifier_total)} × {displayQuantity}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>

    </View>
  );
}
