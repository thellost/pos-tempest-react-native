import { Text, View } from 'react-native';

import type { Order } from '@/db/models';
import { formatIDR } from '@/utils/currency';

interface OrderTotalsProps {
  order: Order;
}

export function OrderTotals({ order }: OrderTotalsProps) {
  const showDiscount = order.discount_amount > 0;
  const showServiceCharge = order.service_charge > 0;
  const showRounding = order.rounding_amount !== 0;

  return (
    <View className="rounded-xl bg-surface-card p-4">
      <View className="flex-row justify-between py-1.5">
        <Text className="text-pos-sm text-pos-text-muted">Subtotal</Text>
        <Text className="text-pos-sm font-medium text-pos-text">
          {formatIDR(order.subtotal)}
        </Text>
      </View>

      {showDiscount && (
        <View className="flex-row justify-between py-1.5">
          <Text className="text-pos-sm text-pos-text-muted">Discount</Text>
          <Text className="text-pos-sm font-semibold text-pos-success">
            −{formatIDR(order.discount_amount)}
          </Text>
        </View>
      )}

      <View className="flex-row justify-between py-1.5">
        <Text className="text-pos-sm text-pos-text-muted">Tax (11%)</Text>
        <Text className="text-pos-sm font-medium text-pos-text">
          {formatIDR(order.tax_amount)}
        </Text>
      </View>

      {showServiceCharge && (
        <View className="flex-row justify-between py-1.5">
          <Text className="text-pos-sm text-pos-text-muted">Service</Text>
          <Text className="text-pos-sm font-medium text-pos-text">
            {formatIDR(order.service_charge)}
          </Text>
        </View>
      )}

      {showRounding && (
        <View className="flex-row justify-between py-1.5">
          <Text className="text-pos-sm text-pos-text-muted">Rounding</Text>
          <Text className="text-pos-sm font-medium text-pos-text">
            {order.rounding_amount > 0 ? '+' : ''}{formatIDR(order.rounding_amount)}
          </Text>
        </View>
      )}

      <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
        <Text className="text-pos-base font-semibold text-pos-text-muted">Total</Text>
        <Text className="text-pos-2xl font-bold text-accent">
          {formatIDR(order.total)}
        </Text>
      </View>
    </View>
  );
}
