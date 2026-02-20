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
      className={`mb-2 rounded-lg border border-white/10 bg-surface-soft p-3 ${
        item.is_voided ? 'opacity-50' : ''
      }`}
    >
      {/* Header: Name and Remove button */}
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-pos-base font-semibold text-pos-text-strong">
            {item.menu_item_name}
          </Text>
          {item.is_voided && (
            <Text className="text-pos-xs text-red-500">VOIDED</Text>
          )}
        </View>
        {!item.is_voided && (
          <Pressable
            onPress={() => onRemove(itemId)}
            className="ml-2 rounded-full bg-red-600/20 px-2 py-1"
          >
            <Text className="text-pos-xs text-red-500">Remove</Text>
          </Pressable>
        )}
      </View>

      {/* Modifiers */}
      {item.modifiers.length > 0 && (
        <View className="mb-2">
          {item.modifiers.map((modifier, index) => (
            <Text key={index} className="text-pos-xs text-pos-muted">
              • {modifier.modifier_name}
              {modifier.extra_price > 0 && ` (+${formatIDR(modifier.extra_price)})`}
            </Text>
          ))}
        </View>
      )}

      {/* Notes */}
      {item.notes && (
        <Text className="mb-2 text-pos-xs italic text-pos-muted">
          Note: {item.notes}
        </Text>
      )}

      {/* Quantity and Price */}
      <View className="flex-row items-center justify-between">
        {/* Quantity controls */}
        {!item.is_voided && (
          <View className="flex-row items-center">
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity - 1)}
              className="h-8 w-8 items-center justify-center rounded-lg bg-surface"
            >
              <Text className="text-pos-lg text-pos-text-strong">−</Text>
            </Pressable>
            <Text className="mx-3 text-pos-base font-semibold text-pos-text-strong">
              {item.quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity + 1)}
              className="h-8 w-8 items-center justify-center rounded-lg bg-surface"
            >
              <Text className="text-pos-lg text-pos-text-strong">+</Text>
            </Pressable>
          </View>
        )}

        {/* Subtotal */}
        <View className="items-end">
          <Text className="text-pos-sm text-pos-muted">
            {formatIDR(item.unit_price + item.modifier_total)} × {item.quantity}
          </Text>
          <Text className="text-pos-lg font-bold text-primary">
            {formatIDR(item.total)}
          </Text>
        </View>
      </View>
    </View>
  );
}
