import { View, Text } from 'react-native';

interface OrderItemBadgeProps {
  variant: 'void' | 'modifier-changed';
}

export function OrderItemBadge({ variant }: OrderItemBadgeProps) {
  if (variant === 'void') {
    return (
      <View className="self-start rounded bg-pos-danger-muted px-1.5 py-0.5">
        <Text className="text-[10px] font-semibold text-pos-danger">VOID</Text>
      </View>
    );
  }

  if (variant === 'modifier-changed') {
    return (
      <View className="ml-1.5 h-2 w-2 rounded-full bg-amber-500" />
    );
  }

  return null;
}
