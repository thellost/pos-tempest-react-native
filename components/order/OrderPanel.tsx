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
    <View className="flex-1 border-l border-white/10 bg-surface-soft">
      <View className="border-b border-white/10 bg-surface-soft px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-pos-xl font-bold text-pos-text-strong">
              {order?.order_number ?? 'New Order'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Pressable
              className="rounded bg-toast-gray-2 px-3 py-1"
              style={{ opacity: order?.order_type === ORDER_TYPE.DINE_IN ? 1 : 0.5 }}
            >
              <Text className="text-pos-sm font-medium text-white">Dine-in</Text>
            </Pressable>
            <Pressable
              className="rounded bg-toast-gray-2 px-3 py-1"
              style={{ opacity: order?.order_type === ORDER_TYPE.TAKEAWAY ? 1 : 0.5 }}
            >
              <Text className="text-pos-sm font-medium text-white">Takeaway</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-pos-sm text-pos-muted">Guests</Text>
          <View className="flex-row items-center">
            <Pressable
              onPress={handleGuestDecrease}
              className="h-8 w-8 items-center justify-center rounded-lg bg-surface"
            >
              <Text className="text-pos-lg text-pos-text-strong">-</Text>
            </Pressable>
            <Text className="mx-4 min-w-[32px] text-center text-pos-lg font-bold text-pos-text-strong">
              {guestCount}
            </Text>
            <Pressable
              onPress={handleGuestIncrease}
              className="h-8 w-8 items-center justify-center rounded-lg bg-surface"
            >
              <Text className="text-pos-lg text-pos-text-strong">+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-pos-lg text-pos-muted">No items added</Text>
            <Text className="mt-1 text-pos-sm text-pos-muted">
              Tap menu items to add
            </Text>
          </View>
        ) : (
          items.map(renderItem)
        )}
      </ScrollView>

      <View className="px-4">
        {order ? (
          <OrderTotals order={order} />
        ) : (
          <View className="border-t border-white/10 py-3">
            <View className="flex-row justify-between">
              <Text className="text-pos-lg font-bold text-pos-text-strong">Total</Text>
              <Text className="text-pos-2xl font-bold text-toast-orange-3">
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
