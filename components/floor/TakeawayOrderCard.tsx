import { Pressable, Text, View } from 'react-native';

import { ShoppingBag } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import type { TakeawayOrder } from '@/hooks/use-takeaway';

interface TakeawayOrderCardProps {
  order: TakeawayOrder;
  cardWidth: string;
  elapsedMinutes: string;
  onPress: () => void;
}

export function TakeawayOrderCard({ order, cardWidth, elapsedMinutes, onPress }: TakeawayOrderCardProps) {
  return (
    <Pressable
      key={`takeaway-${order.id}`}
      onPress={onPress}
      className={`${cardWidth} rounded-sm border border-border bg-surface-card px-3 py-2 active:bg-surface-raised`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <ShoppingBag size={14} color={ThemeColors.text.primary} />
          <Text className="font-mono text-pos-lg font-bold text-pos-text">{order.order_number}</Text>
        </View>
        <Text className="font-mono text-pos-xs text-pos-text-muted">{elapsedMinutes}</Text>
      </View>
      {order.customer_name && (
        <Text className="mt-1 text-pos-sm text-pos-text-muted" numberOfLines={1}>
          {order.customer_name}
        </Text>
      )}
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="font-mono text-pos-base font-semibold text-pos-text">
          Rp {order.total.toLocaleString('id-ID')}
        </Text>
        <View className="rounded px-2 py-0.5 bg-amber-500/20">
          <Text className="text-pos-xs font-bold text-amber-500">{order.status}</Text>
        </View>
      </View>
    </Pressable>
  );
}
