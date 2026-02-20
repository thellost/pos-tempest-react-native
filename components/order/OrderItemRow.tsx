import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OrderItem, OrderItemModifier } from '@/db/models';
import { formatIDR } from '@/utils/currency';

interface OrderItemRowProps {
  item: OrderItem & { modifiers: OrderItemModifier[] };
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemove: (itemId: number) => void;
}

/**
 * Single order item row.
 * Shows qty, name, modifiers, subtotal.
 * Tap to edit qty/notes, swipe to remove.
 */
export function OrderItemRow({ item, onUpdateQuantity, onRemove }: OrderItemRowProps) {
  const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;

  return (
    <View
      className={`mb-2 border border-white/10 bg-surface-soft p-3 ${
        item.is_voided ? 'opacity-50' : ''
      }`}
      style={{ borderRadius: 4 }}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-pos-base font-semibold text-pos-text-strong">
            {item.menu_item_name}
          </Text>
          {item.is_voided && (
            <Text className="text-pos-xs text-pos-danger">VOIDED</Text>
          )}
        </View>
        {!item.is_voided && (
          <Pressable
            onPress={() => onRemove(itemId)}
            className="ml-2 px-2 py-1"
            style={{ backgroundColor: 'rgba(220,38,38,0.2)', borderRadius: 2 }}
          >
            <Text className="text-pos-xs text-pos-danger">Remove</Text>
          </Pressable>
        )}
      </View>

      {item.modifiers.length > 0 && (
        <View className="mb-2">
          {item.modifiers.map((modifier, index) => (
            <Text key={index} className="text-pos-xs text-pos-muted">
              + {modifier.modifier_name}
              {modifier.extra_price > 0 && ` (+${formatIDR(modifier.extra_price)})`}
            </Text>
          ))}
        </View>
      )}

      {item.notes && (
        <Text className="mb-2 text-pos-xs italic text-pos-muted">
          Note: {item.notes}
        </Text>
      )}

      <View className="flex-row items-center justify-between">
        {!item.is_voided && (
          <View className="flex-row items-center">
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity - 1)}
              className="h-8 w-8 items-center justify-center bg-surface"
              style={{ borderRadius: 4 }}
            >
              <Text className="text-pos-lg text-pos-text-strong">-</Text>
            </Pressable>
            <Text className="mx-3 text-pos-base font-semibold text-pos-text-strong">
              {item.quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity + 1)}
              className="h-8 w-8 items-center justify-center bg-surface"
              style={{ borderRadius: 4 }}
            >
              <Text className="text-pos-lg text-pos-text-strong">+</Text>
            </Pressable>
          </View>
        )}

        <View className="items-end">
          <Text className="text-pos-sm text-pos-muted">
            {formatIDR(item.unit_price + item.modifier_total)} x {item.quantity}
          </Text>
          <Text className="text-pos-lg font-bold text-toast-orange-3">
            {formatIDR(item.total)}
          </Text>
        </View>
      </View>
    </View>
  );
}
