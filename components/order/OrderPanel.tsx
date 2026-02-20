import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { Order, OrderItem, OrderItemModifier } from '@/db/models';
import { formatIDR } from '@/utils/currency';
import { OrderItemRow } from './OrderItemRow';

interface OrderPanelProps {
  order: Order | null;
  items: (OrderItem & { modifiers: OrderItemModifier[] })[];
  guestCount: number;
  onGuestCountChange: (count: number) => void;
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemoveItem: (itemId: number) => void;
  onSendToKitchen?: () => void;
  onPayment?: () => void;
  onHold?: () => void;
}

/**
 * Right-side panel showing order summary.
 * Displays guest count, order items list, and running totals.
 */
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
  const hasItems = items.length > 0 && items.some(i => !i.is_voided);

  return (
    <View className="flex-1 border-l border-white/10 bg-surface-soft">
      <View className="flex-1 p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="mb-2 text-pos-xl font-bold text-pos-text-strong">
            Current Order
          </Text>
          {order && (
            <Text className="text-pos-sm text-pos-muted">
              {order.order_number}
            </Text>
          )}
        </View>

        {/* Guest Count */}
        <View className="mb-4">
          <Text className="mb-2 text-pos-sm text-pos-muted">Guest Count</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 rounded-lg border border-white/20 bg-surface px-3 py-2 text-pos-base text-pos-text-strong"
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={guestCount.toString()}
              onChangeText={(text) => {
                const count = parseInt(text) || 0;
                onGuestCountChange(count);
              }}
            />
          </View>
        </View>

        {/* Order Items */}
        <View className="mb-4 flex-1">
          <Text className="mb-2 text-pos-sm text-pos-muted">
            Items ({items.filter(i => !i.is_voided).length})
          </Text>
          <ScrollView className="flex-1">
            {items.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Text className="text-pos-base text-pos-muted">
                  No items added yet
                </Text>
                <Text className="mt-2 text-pos-sm text-pos-muted">
                  Select items from the menu
                </Text>
              </View>
            ) : (
              items.map((item) => (
                <OrderItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                />
              ))
            )}
          </ScrollView>
        </View>

        {/* Totals */}
        {order && (
          <View className="border-t border-white/10 pt-4">
            <View className="mb-2 flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Subtotal</Text>
              <Text className="text-pos-sm text-pos-text-strong">
                {formatIDR(order.subtotal)}
              </Text>
            </View>

            {order.discount_amount > 0 && (
              <View className="mb-2 flex-row justify-between">
                <Text className="text-pos-sm text-pos-muted">Discount</Text>
                <Text className="text-pos-sm text-green-500">
                  -{formatIDR(order.discount_amount)}
                </Text>
              </View>
            )}

            <View className="mb-2 flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Tax</Text>
              <Text className="text-pos-sm text-pos-text-strong">
                {formatIDR(order.tax_amount)}
              </Text>
            </View>

            <View className="mb-2 flex-row justify-between">
              <Text className="text-pos-sm text-pos-muted">Service</Text>
              <Text className="text-pos-sm text-pos-text-strong">
                {formatIDR(order.service_charge)}
              </Text>
            </View>

            {order.rounding_amount !== 0 && (
              <View className="mb-2 flex-row justify-between">
                <Text className="text-pos-sm text-pos-muted">Rounding</Text>
                <Text className="text-pos-sm text-pos-text-strong">
                  {formatIDR(order.rounding_amount)}
                </Text>
              </View>
            )}

            <View className="mt-2 flex-row justify-between border-t border-white/10 pt-2">
              <Text className="text-pos-lg font-bold text-pos-text-strong">Total</Text>
              <Text className="text-pos-2xl font-bold text-primary">
                {formatIDR(order.total)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons - Fixed at bottom like Toast POS */}
      <View className="border-t border-white/10 bg-surface p-4">
        <View className="flex-row gap-2">
          <TouchableOpacity
            className={`flex-1 rounded-lg py-4 ${hasItems ? 'bg-gray-600' : 'bg-gray-600/50'}`}
            disabled={!hasItems}
            onPress={onHold}
          >
            <Text className={`text-center text-pos-base font-semibold ${hasItems ? 'text-white' : 'text-white/50'}`}>
              Hold
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 rounded-lg py-4 ${hasItems ? 'bg-orange-600' : 'bg-orange-600/50'}`}
            disabled={!hasItems}
            onPress={onSendToKitchen}
          >
            <Text className={`text-center text-pos-base font-semibold ${hasItems ? 'text-white' : 'text-white/50'}`}>
              Send
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className={`mt-2 rounded-lg py-4 ${hasItems ? 'bg-green-600' : 'bg-green-600/50'}`}
          disabled={!hasItems}
          onPress={onPayment}
        >
          <Text className={`text-center text-pos-lg font-bold ${hasItems ? 'text-white' : 'text-white/50'}`}>
            Payment
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
