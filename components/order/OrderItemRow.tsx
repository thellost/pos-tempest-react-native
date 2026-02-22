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
      className={`mb-2 overflow-hidden bg-surface-card p-3 ${
        item.is_voided ? 'opacity-50' : ''
      }`}
      style={{ borderRadius: 8 }}
    >
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-pos-sm font-semibold text-pos-text" numberOfLines={2}>
            {item.menu_item_name}
          </Text>
          {item.is_voided ? (
            <View className="mt-1 self-start rounded bg-pos-danger-muted px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-pos-danger">VOIDED</Text>
            </View>
          ) : null}
        </View>
        {!item.is_voided ? (
          <Pressable
            onPress={() => onRemove(itemId)}
            className="rounded bg-pos-danger-muted px-2 py-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-[10px] font-semibold text-pos-danger">Remove</Text>
          </Pressable>
        ) : null}
      </View>

      {item.modifiers.length > 0 ? (
        <View className="mb-2 rounded bg-surface-raised p-1.5">
          {item.modifiers.map((modifier, index) => (
            <Text key={index} className="text-[10px] text-pos-text-muted">
              + {modifier.modifier_name}
              {modifier.extra_price > 0 && ` (+${formatIDR(modifier.extra_price)})`}
            </Text>
          ))}
        </View>
      ) : null}

      {Boolean(item.notes) ? (
        <View className="mb-2 rounded bg-accent-muted px-2 py-1">
          <Text className="text-[10px] italic text-accent" numberOfLines={1}>
            📝 {item.notes}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        {!item.is_voided ? (
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity - 1)}
              className="h-6 w-6 items-center justify-center bg-surface-raised"
              style={({ pressed }) => ({ borderRadius: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-pos-sm text-pos-text">−</Text>
            </Pressable>
            <Text className="min-w-[20px] text-center text-pos-sm font-bold text-pos-text">
              {item.quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQuantity(itemId, item.quantity + 1)}
              className="h-6 w-6 items-center justify-center bg-surface-raised"
              style={({ pressed }) => ({ borderRadius: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="text-pos-sm text-pos-text">+</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-1 items-end">
          <Text className="text-[10px] text-pos-text-faint">
            {formatIDR(item.unit_price + item.modifier_total)} × {item.quantity}
          </Text>
          <Text className="text-pos-sm font-bold text-accent">
            {formatIDR(item.total)}
          </Text>
        </View>
      </View>
    </View>
  );
}
