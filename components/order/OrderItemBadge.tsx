import { View, Text } from 'react-native';

interface OrderItemBadgeProps {
  variant: 'void' | 'modifiers';
  count?: number;
}

export function OrderItemBadge({ variant, count }: OrderItemBadgeProps) {
  if (variant === 'void') {
    return (
      <View className="self-start rounded bg-pos-danger-muted px-1.5 py-0.5">
        <Text className="text-[10px] font-semibold text-pos-danger">VOID</Text>
      </View>
    );
  }

  if (variant === 'modifiers') {
    const countLabel = typeof count === 'number' ? ` ${count}` : '';
    return (
      <View className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5">
        <Text className="text-[10px] font-semibold text-amber-400">MODS{countLabel}</Text>
      </View>
    );
  }

  return null;
}
