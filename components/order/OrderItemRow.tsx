import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Swipeable } from 'react-native-gesture-handler';

import { OrderItemBadge } from '@/components/order/OrderItemBadge';
import { QuickEditPopover } from '@/components/order/QuickEditPopover';
import type { OrderItem, OrderItemModifier } from '@/db/models';
import { formatIDR } from '@/utils/currency';

interface OrderItemRowProps {
  item: OrderItem & { modifiers: OrderItemModifier[] };
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemove: (itemId: number) => void;
  onUpdateNotes: (itemId: number, notes: string) => void;
}

export function OrderItemRow({ item, onUpdateQuantity, onRemove, onUpdateNotes }: OrderItemRowProps) {
  const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);
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
        setIsPopoverVisible(true);
      }}
      className="h-full w-[72px] items-center justify-center bg-amber-500"
    >
      <MaterialIcons name="edit" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Edit</Text>
    </Pressable>
  ), [closeSwipeable]);

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
          onPress={() => setIsPopoverVisible(true)}
          className="mb-2 overflow-hidden rounded-sm bg-surface-card p-3 active:opacity-90"
        >
          <View className="flex-row items-start justify-between">
            <View className="mr-3 items-center">
              <Pressable
                onPress={() => onUpdateQuantity(itemId, displayQuantity + 1)}
                className="h-8 w-8 items-center justify-center rounded-full bg-surface-raised"
              >
                <Text className="text-pos-sm font-bold text-pos-text">{displayQuantity}</Text>
              </Pressable>
            </View>

            <View className="flex-1 pr-2">
              <View className="flex-row items-center">
                <Text className="text-pos-sm font-semibold text-pos-text" numberOfLines={2}>
                  {item.menu_item_name}
                </Text>
                {item.is_voided ? <OrderItemBadge variant="void" /> : null}
                {!item.is_voided && item.modifiers.length > 0 ? (
                  <OrderItemBadge variant="modifier-changed" />
                ) : null}
              </View>
            </View>

            {!item.is_voided ? (
              <Pressable
                onPress={() => {
                  closeSwipeable();
                  onRemove(itemId);
                }}
                className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-pos-danger-muted"
              >
                <MaterialIcons name="delete" size={18} color="#ef4444" />
              </Pressable>
            ) : null}
          </View>

          {item.modifiers.length > 0 ? (
            <View className="mt-2 rounded bg-surface-raised p-1.5">
              {item.modifiers.map((modifier, index) => (
                <Text key={index} className="text-[10px] text-pos-text-muted">
                  + {modifier.modifier_name}
                  {modifier.extra_price > 0 && ` (+${formatIDR(modifier.extra_price)})`}
                </Text>
              ))}
            </View>
          ) : null}

          {Boolean(item.notes) ? (
            <View className="mt-2 rounded bg-accent-muted px-2 py-1">
              <Text className="text-[10px] italic text-accent" numberOfLines={1}>
                📝 {item.notes}
              </Text>
            </View>
          ) : null}

          <View className="mt-2 flex-row items-center justify-between">
            {!item.is_voided ? (
              <View className="flex-row items-center gap-1.5">
                <Pressable
                  onPress={() => onUpdateQuantity(itemId, displayQuantity - 1)}
                  className="h-6 w-6 items-center justify-center rounded-sm bg-surface-raised active:opacity-60"
                >
                  <Text className="text-pos-sm text-pos-text">−</Text>
                </Pressable>
                <Text className="min-w-[20px] text-center text-pos-sm font-bold text-pos-text">
                  {displayQuantity}
                </Text>
                <Pressable
                  onPress={() => onUpdateQuantity(itemId, displayQuantity + 1)}
                  className="h-6 w-6 items-center justify-center rounded-sm bg-surface-raised active:opacity-60"
                >
                  <Text className="text-pos-sm text-pos-text">+</Text>
                </Pressable>
              </View>
            ) : null}

            <View className="flex-1 items-end">
              <Text className="text-[10px] text-pos-text-faint">
                {formatIDR(item.unit_price + item.modifier_total)} × {displayQuantity}
              </Text>
              <Text className="text-pos-sm font-bold text-accent">
                {formatIDR(item.total)}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>

      <QuickEditPopover
        visible={isPopoverVisible}
        itemName={item.menu_item_name}
        quantity={displayQuantity}
        notes={item.notes}
        onClose={() => setIsPopoverVisible(false)}
        onUpdate={(quantity, notes) => {
          onUpdateQuantity(itemId, quantity);
          onUpdateNotes(itemId, notes);
          setIsPopoverVisible(false);
        }}
        onRemove={() => {
          onRemove(itemId);
          setIsPopoverVisible(false);
        }}
      />
    </View>
  );
}
