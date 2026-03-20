import { useCallback, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, IconButton } from '@/components/ui';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Swipeable } from 'react-native-gesture-handler';

import { OrderItemBadge } from '@/components/order/OrderItemBadge';
import type { OrderItemDisplay } from '@/components/order/types';
import { formatIDR } from '@/utils/currency';

interface OrderItemRowProps {
  item: OrderItemDisplay;
  onUpdateQuantity: (itemId: number | string, newQuantity: number) => void;
  onRemove: (itemId: number | string) => void;
  onEditModifiers: (itemId: number | string) => void;
}

export function OrderItemRow({
  item,
  onUpdateQuantity,
  onRemove,
  onEditModifiers,
}: OrderItemRowProps) {
  const itemId = item.id;
  const swipeableRef = useRef<Swipeable | null>(null);

  const displayQuantity = typeof item.quantity === 'string'
    ? parseInt(item.quantity as string, 10)
    : item.quantity;
  const modifierText = item.modifiers.map((modifier) => modifier.modifier_name).join(', ');
  const notesText = item.notes?.trim() ?? '';
  const shouldBreakNotes = notesText.length > 28;
  const itemMetaText = modifierText.length > 0 && notesText.length > 0
    ? `${modifierText}${shouldBreakNotes ? ',\n' : ', '}${notesText}`
    : [modifierText, notesText].filter((value) => value.length > 0).join(', ');

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  // Auto-execute action when swipe reaches full open (no tap required)
  const handleSwipeableOpen = useCallback((direction: 'left' | 'right') => {
    if (item.is_voided) return;
    if (direction === 'right') {
      // Swiped left → delete action
      swipeableRef.current?.close();
      onRemove(itemId);
    } else if (direction === 'left') {
      // Swiped right → edit action
      swipeableRef.current?.close();
      onEditModifiers(itemId);
    }
  }, [item.is_voided, itemId, onRemove, onEditModifiers]);

  const rightActions = useMemo(() => (
    <View className="h-full w-[72px] items-center justify-center bg-pos-danger">
      <MaterialIcons name="delete" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Delete</Text>
    </View>
  ), []);

  const leftActions = useMemo(() => (
    <View className="h-full w-[72px] items-center justify-center bg-amber-500">
      <MaterialIcons name="edit" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Edit</Text>
    </View>
  ), []);

  return (
    <View className={item.is_voided ? 'opacity-50' : ''}>
      <Swipeable
        ref={(ref) => {
          swipeableRef.current = ref;
        }}
        renderLeftActions={() => (item.is_voided ? null : leftActions)}
        renderRightActions={() => (item.is_voided ? null : rightActions)}
        onSwipeableOpen={handleSwipeableOpen}
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

              {itemMetaText.length > 0 && (
                <Text className="mt-0.5 text-[10px] leading-4 text-pos-text-faint">
                  {itemMetaText}
                </Text>
              )}
            </View>
            
          <View className="mt-1.5 flex-row items-center justify-between">
            {!item.is_voided ? (
              <View className="flex-row items-center gap-1.5">
                <IconButton
                  size="sm"
                  onPress={() => onUpdateQuantity(itemId, displayQuantity - 1)}
                  className="bg-surface-raised"
                >
                  <Text className="text-[11px] text-pos-text">−</Text>
                </IconButton>
                <Text className="min-w-[14px] text-center text-[11px] font-semibold text-pos-text">
                  {displayQuantity}
                </Text>
                <IconButton
                  size="sm"
                  onPress={() => onUpdateQuantity(itemId, displayQuantity + 1)}
                  className="bg-surface-raised"
                >
                  <Text className="text-[11px] text-pos-text">+</Text>
                </IconButton>
              </View>
            ) : null}


            {!item.is_voided ? (
              <View className="ml-2 flex-row items-center gap-1.5">
                <Button
                  onPress={() => onEditModifiers(itemId)}
                  className="h-6 w-6 items-center justify-center rounded-full bg-amber-500/15"
                >
                  <MaterialIcons name="edit" size={14} color="#F59E0B" />
                </Button>

                <Text className="text-pos-sm font-bold text-accent">
                  {formatIDR(item.total)}
                </Text>
              </View>
            ) : null}
          </View>

          </View>
        </Pressable>
      </Swipeable>

    </View>
  );
}
