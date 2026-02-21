import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ORDER_TYPE, ORDER_STATUS } from '@/constants/enums';
import type { Order, OrderItem, OrderItemModifier } from '@/db/models';
import { formatIDR } from '@/utils/currency';
import { OrderActions } from './OrderActions';
import { OrderItemRow } from './OrderItemRow';
import { OrderTotals } from './OrderTotals';

interface OrderPanelProps {
  order: Order | null;
  items: (OrderItem & { modifiers: OrderItemModifier[] })[];
  guestCount: number;
  onGuestCountChange: (count: number) => void;
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onSendToKitchen: () => void;
  onPayment: () => void;
  onHold: () => void;
}

export function OrderPanel({
  order,
  items,
  guestCount,
  onGuestCountChange,
  onUpdateQuantity,
  onRemoveItem,
  onSendToKitchen,
  onPayment,
  onHold,
}: OrderPanelProps) {
  const activeItems = items.filter(i => !i.is_voided);
  const hasItems = activeItems.length > 0;
  const orderStatus = order?.status ?? ORDER_STATUS.PENDING;

  const handleGuestDecrease = useCallback(() => {
    if (guestCount > 0) {
      onGuestCountChange(guestCount - 1);
    }
  }, [guestCount, onGuestCountChange]);

  const handleGuestIncrease = useCallback(() => {
    onGuestCountChange(guestCount + 1);
  }, [guestCount, onGuestCountChange]);

  const renderItem = useCallback((item: OrderItem & { modifiers: OrderItemModifier[] }) => {
    return (
      <OrderItemRow
        key={`order-item-${item.id}`}
        item={item}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemoveItem}
      />
    );
  }, [onUpdateQuantity, onRemoveItem]);

  const emptySubtotal = items.reduce((sum, item) => sum + (item.is_voided ? 0 : item.total), 0);

  return (
    <View className="flex-1 border-r border-border bg-surface-soft">
      <View className="border-b border-border bg-surface-card px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-pos-lg font-bold text-pos-text">
              {order?.order_number ?? 'New Order'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              className="px-3 py-1.5"
              style={({ pressed }) => ({
                backgroundColor: order?.order_type === ORDER_TYPE.DINE_IN ? '#6366F1' : 'transparent',
                borderRadius: 6,
                borderWidth: order?.order_type === ORDER_TYPE.DINE_IN ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.12)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text className={`text-pos-xs font-semibold ${order?.order_type === ORDER_TYPE.DINE_IN ? 'text-white' : 'text-pos-text-muted'}`}>Dine-in</Text>
            </Pressable>
            <Pressable
              className="px-3 py-1.5"
              style={({ pressed }) => ({
                backgroundColor: order?.order_type === ORDER_TYPE.TAKEAWAY ? '#6366F1' : 'transparent',
                borderRadius: 6,
                borderWidth: order?.order_type === ORDER_TYPE.TAKEAWAY ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.12)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text className={`text-pos-xs font-semibold ${order?.order_type === ORDER_TYPE.TAKEAWAY ? 'text-white' : 'text-pos-text-muted'}`}>Takeaway</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-pos-xs text-pos-text-muted">Guests</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleGuestDecrease}
              className="h-7 w-7 items-center justify-center bg-surface-raised"
              style={({ pressed }) => ({ borderRadius: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-pos-sm text-pos-text">−</Text>
            </Pressable>
            <Text className="min-w-[24px] text-center text-pos-sm font-bold text-pos-text">
              {guestCount}
            </Text>
            <Pressable
              onPress={handleGuestIncrease}
              className="h-7 w-7 items-center justify-center bg-surface-raised"
              style={({ pressed }) => ({ borderRadius: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-pos-sm text-pos-text">+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-3"
        contentContainerStyle={{ paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View className="items-center justify-center py-12">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-surface-card">
              <Text className="text-2xl">🍽️</Text>
            </View>
            <Text className="text-pos-sm text-pos-text-muted">No items added</Text>
            <Text className="mt-1 text-pos-xs text-pos-text-faint">
              Tap menu items to add
            </Text>
          </View>
        ) : (
          items.map(renderItem)
        )}
      </ScrollView>

      <View className="px-3">
        {order ? (
          <OrderTotals order={order} />
        ) : (
          <View className="border-t border-border py-3">
            <View className="flex-row justify-between">
              <Text className="text-pos-sm font-semibold text-pos-text-muted">Total</Text>
              <Text className="text-pos-xl font-bold text-accent">
                {formatIDR(emptySubtotal)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <OrderActions
        orderStatus={orderStatus}
        hasItems={hasItems}
        onSendToKitchen={onSendToKitchen}
        onHold={onHold}
        onPayment={onPayment}
      />
    </View>
  );
}
