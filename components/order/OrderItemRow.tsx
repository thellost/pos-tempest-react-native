import { memo, useCallback, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Swipeable } from 'react-native-gesture-handler';

import { OrderItemBadge } from '@/components/order/OrderItemBadge';
import type { OrderItemDisplay } from '@/components/order/types';
import { Button, IconButton } from '@/components/ui';
import { useLayout } from '@/hooks/use-layout';
import { formatIDR } from '@/utils/currency';
import { isRenderProfilerEnabled, useRenderTimer } from '@/utils/perf-debug';

interface OrderItemRowProps {
  item: OrderItemDisplay;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemove: (itemId: string) => void;
  onEditModifiers: (itemId: string) => void;
  /** When true, the row is read-only. */
  locked?: boolean;
}

type OrderItemModifier = OrderItemDisplay['modifiers'][number];

function areModifiersEqual(
  previousModifiers: OrderItemModifier[],
  nextModifiers: OrderItemModifier[]
): boolean {
  if (previousModifiers.length !== nextModifiers.length) {
    return false;
  }

  for (let index = 0; index < previousModifiers.length; index += 1) {
    const previousModifier = previousModifiers[index];
    const nextModifier = nextModifiers[index];

    if (
      previousModifier.modifier_id !== nextModifier.modifier_id ||
      previousModifier.modifier_name !== nextModifier.modifier_name ||
      previousModifier.modifier_group_name !== nextModifier.modifier_group_name ||
      previousModifier.extra_price !== nextModifier.extra_price
    ) {
      return false;
    }
  }

  return true;
}

function getOrderItemChangeLabels(
  previousItem: OrderItemDisplay,
  nextItem: OrderItemDisplay
): string[] {
  const changes: string[] = [];

  if (previousItem.id !== nextItem.id) changes.push('id');
  if (previousItem.menu_item_name !== nextItem.menu_item_name) changes.push('menu_item_name');
  if (previousItem.quantity !== nextItem.quantity) changes.push('quantity');
  if (previousItem.total !== nextItem.total) changes.push('total');
  if (previousItem.notes !== nextItem.notes) changes.push('notes');
  if (previousItem.is_voided !== nextItem.is_voided) changes.push('is_voided');
  if (previousItem.round_number !== nextItem.round_number) changes.push('round_number');
  if (previousItem.category_group !== nextItem.category_group) changes.push('category_group');
  if (previousItem.weight !== nextItem.weight) changes.push('weight');
  if (!areModifiersEqual(previousItem.modifiers, nextItem.modifiers)) changes.push('modifiers');

  return changes;
}

function areOrderItemsEqual(previousItem: OrderItemDisplay, nextItem: OrderItemDisplay): boolean {
  return previousItem.id === nextItem.id
    && previousItem.menu_item_name === nextItem.menu_item_name
    && previousItem.quantity === nextItem.quantity
    && previousItem.total === nextItem.total
    && previousItem.notes === nextItem.notes
    && previousItem.is_voided === nextItem.is_voided
    && previousItem.round_number === nextItem.round_number
    && previousItem.category_group === nextItem.category_group
    && previousItem.weight === nextItem.weight
    && areModifiersEqual(previousItem.modifiers, nextItem.modifiers);
}

function areOrderItemRowPropsEqual(previousProps: OrderItemRowProps, nextProps: OrderItemRowProps): boolean {
  const areEqual = previousProps.locked === nextProps.locked
    && previousProps.onUpdateQuantity === nextProps.onUpdateQuantity
    && previousProps.onRemove === nextProps.onRemove
    && previousProps.onEditModifiers === nextProps.onEditModifiers
    && areOrderItemsEqual(previousProps.item, nextProps.item);

  if (!areEqual && isRenderProfilerEnabled()) {
    const changes = getOrderItemChangeLabels(previousProps.item, nextProps.item);

    if (previousProps.locked !== nextProps.locked) changes.push('locked');
    if (previousProps.onUpdateQuantity !== nextProps.onUpdateQuantity) changes.push('onUpdateQuantity');
    if (previousProps.onRemove !== nextProps.onRemove) changes.push('onRemove');
    if (previousProps.onEditModifiers !== nextProps.onEditModifiers) changes.push('onEditModifiers');

    console.log(`[⏱ perf] 🟡 why:OrderItemRow:${nextProps.item.id.slice(-6)}`, { changes });
  }

  return areEqual;
}

function OrderItemRowComponent({
  item,
  onUpdateQuantity,
  onRemove,
  onEditModifiers,
  locked = false,
}: OrderItemRowProps) {
  useRenderTimer(`OrderItemRow:${item.id.slice(-6)}`);

  const itemId = item.id;
  const swipeableRef = useRef<Swipeable | null>(null);
  const { isPhone } = useLayout();
  const iconSize: 'sm' | 'md' = isPhone ? 'md' : 'sm';

  const displayQuantity = typeof item.quantity === 'string'
    ? parseInt(item.quantity as string, 10)
    : item.quantity;
  const modifierText = item.modifiers.map((modifier) => modifier.modifier_name).join(', ');
  const notesText = item.notes?.trim() ?? '';
  const shouldBreakNotes = notesText.length > 28;
  const itemMetaText = modifierText.length > 0 && notesText.length > 0
    ? `${modifierText}${shouldBreakNotes ? ',\n' : ', '}${notesText}`
    : [modifierText, notesText].filter((value) => value.length > 0).join(', ');
  const isDisabled = locked || item.is_voided;

  const handleSwipeableRef = useCallback((ref: Swipeable | null) => {
    swipeableRef.current = ref;
  }, []);

  const handleIncrease = useCallback(() => {
    onUpdateQuantity(itemId, displayQuantity + 1);
  }, [displayQuantity, itemId, onUpdateQuantity]);

  const handleDecrease = useCallback(() => {
    onUpdateQuantity(itemId, displayQuantity - 1);
  }, [displayQuantity, itemId, onUpdateQuantity]);

  const handleRemove = useCallback(() => {
    onRemove(itemId);
  }, [itemId, onRemove]);

  const handleEditItem = useCallback(() => {
    onEditModifiers(itemId);
  }, [itemId, onEditModifiers]);

  const handleSwipeableOpen = useCallback((direction: 'left' | 'right') => {
    if (isDisabled) {
      return;
    }

    swipeableRef.current?.close();

    if (direction === 'right') {
      handleRemove();
      return;
    }

    handleEditItem();
  }, [handleEditItem, handleRemove, isDisabled]);

  const rightActions = useMemo(() => (
    <View className="h-full w-[60px] items-center justify-center bg-pos-danger">
      <MaterialIcons name="delete" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Delete</Text>
    </View>
  ), []);

  const leftActions = useMemo(() => (
    <View className="h-full w-[60px] items-center justify-center bg-amber-500">
      <MaterialIcons name="edit" size={20} color="#fff" />
      <Text className="mt-1 text-[10px] font-semibold text-white">Edit</Text>
    </View>
  ), []);

  const renderLeftActions = useCallback(
    () => (isDisabled ? null : leftActions),
    [isDisabled, leftActions]
  );

  const renderRightActions = useCallback(
    () => (isDisabled ? null : rightActions),
    [isDisabled, rightActions]
  );

  return (
    <View className={`mb-1.5 overflow-hidden rounded-sm ${item.is_voided ? 'opacity-50' : locked ? 'opacity-70' : ''}`}>
      <Swipeable
        ref={handleSwipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeableOpen}
        overshootLeft={false}
        overshootRight={false}
        leftThreshold={40}
        rightThreshold={40}
      >
        <Pressable
          onPress={isDisabled ? undefined : handleEditItem}
          className={`overflow-hidden bg-surface-card px-2.5 py-2 ${isDisabled ? '' : 'active:opacity-90'}`}
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
          </View>

          <View className="mt-1.5 flex-row items-center justify-between">
            {!isDisabled ? (
              <View className="flex-row items-center gap-1.5">
                <IconButton
                  size={iconSize}
                  onPress={handleDecrease}
                  className="bg-pos-danger/15"
                >
                  <Text className="text-[11px] font-bold text-pos-danger">−</Text>
                </IconButton>
                <Text className="min-w-[14px] text-center font-mono text-[11px] font-semibold text-pos-text">
                  {displayQuantity}
                </Text>
                <IconButton
                  size={iconSize}
                  onPress={handleIncrease}
                  className="bg-surface-raised"
                >
                  <Text className="text-[11px] text-pos-text">+</Text>
                </IconButton>
              </View>
            ) : (
              <Text className="font-mono text-[11px] font-semibold text-pos-text-muted">
                ×{displayQuantity}
              </Text>
            )}

            <View className="ml-2 flex-row items-center gap-1.5">
              {!isDisabled ? (
                <Button
                  onPress={handleEditItem}
                  className="h-6 w-6 items-center justify-center rounded-full bg-amber-500/15"
                >
                  <MaterialIcons name="edit" size={14} color="#F59E0B" />
                </Button>
              ) : null}

              <Text className={`font-mono text-pos-sm font-bold ${locked ? 'text-pos-text-muted' : 'text-accent'}`}>
                {formatIDR(item.total)}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

export const OrderItemRow = memo(OrderItemRowComponent, areOrderItemRowPropsEqual);
