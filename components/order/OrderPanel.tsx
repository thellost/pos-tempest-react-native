import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ORDER_STATUS, ORDER_TYPE } from '@/constants/enums';
import type { Order } from '@/db/models';
import type { OrderItemDisplay } from '@/components/order/types';
import { formatIDR } from '@/utils/currency';
import { OrderActions } from './OrderActions';
import { OrderItemRow } from './OrderItemRow';
import { OrderTotals } from './OrderTotals';

interface OrderPanelProps {
  order: Order | null;
  items: OrderItemDisplay[];
  guestCount: number | null;
  onGuestCountChange: (count: number) => void;
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onEditModifiers: (itemId: number) => void;
  onConfirmOrder: () => void;
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
  onEditModifiers,
  onConfirmOrder,
  onRemoveItem,
  onSendToKitchen,
  onPayment,
  onHold,
}: OrderPanelProps) {
  const activeItems = items.filter(i => !i.is_voided);
  const hasItems = activeItems.length > 0;
  const orderStatus = order?.status ?? ORDER_STATUS.PENDING;
  const isDineIn = order?.order_type === ORDER_TYPE.DINE_IN;
  const isTakeaway = order?.order_type === ORDER_TYPE.TAKEAWAY;
  const isConfirmed = orderStatus === ORDER_STATUS.CONFIRMED;
  const showConfirmButton = !isConfirmed && hasItems;

  const handleGuestDecrease = useCallback(() => {
    if (guestCount !== null && guestCount > 0) {
      onGuestCountChange(guestCount - 1);
    }
  }, [guestCount, onGuestCountChange]);

  const handleGuestIncrease = useCallback(() => {
    if (guestCount !== null) {
      onGuestCountChange(guestCount + 1);
    }
  }, [guestCount, onGuestCountChange]);

  const renderedItems = useMemo(() => {
    return items.map((item) => (
      <OrderItemRow
        key={`order-item-${item.id}`}
        item={item}
        onUpdateQuantity={onUpdateQuantity}
        onEditModifiers={onEditModifiers}
        onRemove={onRemoveItem}
      />
    ));
  }, [items, onEditModifiers, onUpdateQuantity, onRemoveItem]);

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
          <View className="flex-row items-center gap-2">
            <Pressable
              className={`px-3 py-1.5 rounded-sm ${isDineIn ? 'bg-brand' : 'border border-border bg-transparent'}`}
            >
              <Text className={`text-pos-xs font-semibold ${isDineIn ? 'text-white' : 'text-pos-text-muted'}`}>
                Dine-in
              </Text>
            </Pressable>
            <Pressable
              className={`px-3 py-1.5 rounded-sm ${isTakeaway ? 'bg-brand' : 'border border-border bg-transparent'}`}
            >
              <Text className={`text-pos-xs font-semibold ${isTakeaway ? 'text-white' : 'text-pos-text-muted'}`}>
                Takeaway
              </Text>
            </Pressable>
            {!isConfirmed && showConfirmButton && (
              <Pressable
                onPress={onConfirmOrder}
                className="rounded-sm bg-amber-500 px-3 py-1.5 active:opacity-80"
              >
                <Text className="text-pos-xs font-semibold text-white">Confirm</Text>
              </Pressable>
            )}
          </View>
        </View>

        {guestCount !== null && (
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-pos-xs text-pos-text-muted">Guests</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleGuestDecrease}
                className="h-7 w-7 items-center justify-center rounded-sm bg-surface-raised active:opacity-60"
              >
                <Text className="text-pos-sm text-pos-text">−</Text>
              </Pressable>
              <Text className="min-w-[24px] text-center text-pos-sm font-bold text-pos-text">
                {guestCount}
              </Text>
              <Pressable
                onPress={handleGuestIncrease}
                className="h-7 w-7 items-center justify-center rounded-sm bg-surface-raised active:opacity-60"
              >
                <Text className="text-pos-sm text-pos-text">+</Text>
              </Pressable>
            </View>
          </View>
        )}
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
          renderedItems
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
