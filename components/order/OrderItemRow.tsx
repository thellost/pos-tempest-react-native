import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OrderItem, OrderItemModifier } from '@/db/models';
import { formatIDR } from '@/utils/currency';

interface OrderItemRowProps {
  item: OrderItem & { modifiers: OrderItemModifier[] };
  onUpdateQuantity: (itemId: number, newQuantity: number) => void;
  onRemove: (itemId: number) => void;
}

export function OrderItemRow({ item, onUpdateQuantity, onRemove }: OrderItemRowProps) {
  const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;

  return (
    <View
      className={`mb-3 overflow-hidden bg-surface-card p-4 ${
        item.is_voided ? 'opacity-50' : ''
      }`}
      style={{ borderRadius: 12 }}
    >
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-pos-base font-semibold text-pos-text">
            {item.menu_item_name}
          </Text>
          {item.is_voided && (
            <View className="mt-1 self-start rounded-md bg-pos-danger-muted px-2 py-0.5">
              <Text className="text-pos-xs font-semibold text-pos-danger">VOIDED</Text>
            </View>
          )}
        </View>
        {!item.is_voided && (
          <Pressable
            onPress={() => onRemove(itemId)}
            className="rounded-lg bg-pos-danger-muted px-3 py-1.5"
          >
            <Text className="text-pos-xs font-semibold text-pos-danger">Remove</Text>
          </Pressable>
        )}
      </View>

      {item.modifiers.length > 0 && (
        <View className="mb-3 rounded-lg bg-surface-raised p-2">
          {item.modifiers.map((modifier, index) => (
            <Text key={index} className="text-pos-xs text-pos-text-muted">
              + {modifier.modifier_name}
              {modifier.extra_price > 0 && ` (+${formatIDR(modifier.extra_price)})`}
            </Text>
          ))}
        </View>
      )}

      {item.notes && (
        <View className="mb-3 rounded-lg bg-accent-muted px-3 py-2">
          <Text className="text-pos-xs italic text-accent">
            📝 {item.notes}
          </Text>
        </View>
      )}

      <View className="flex-row items-center justify-between">
        {!item.is_voided && (
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity - 1)}
              className="h-9 w-9 items-center justify-center bg-surface-raised"
              style={{ borderRadius: 8 }}
            >
              <Text className="text-pos-base text-pos-text">−</Text>
            </Pressable>
            <Text className="min-w-[28px] text-center text-pos-base font-bold text-pos-text">
              {item.quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity + 1)}
              className="h-9 w-9 items-center justify-center bg-surface-raised"
              style={{ borderRadius: 8 }}
            >
              <Text className="text-pos-base text-pos-text">+</Text>
            </Pressable>
          </View>
        )}

        <View className="flex-1 items-end">
          <Text className="text-pos-xs text-pos-text-faint">
            {formatIDR(item.unit_price + item.modifier_total)} × {item.quantity}
          </Text>
          <Text className="text-pos-lg font-bold text-accent">
            {formatIDR(item.total)}
          </Text>
        </View>
      </View>
    </View>
  );
}
