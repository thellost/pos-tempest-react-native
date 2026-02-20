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
    <View className="border-t border-white/10 py-3">
      <View className="flex-row justify-between py-1">
        <Text className="text-pos-sm text-pos-muted">Subtotal</Text>
        <Text className="text-pos-sm text-pos-text-strong">
          {formatIDR(order.subtotal)}
        </Text>
      </View>

      {showDiscount && (
        <View className="flex-row justify-between py-1">
          <Text className="text-pos-sm text-pos-muted">Discount</Text>
          <Text className="text-pos-sm text-pos-success">
            -{formatIDR(order.discount_amount)}
          </Text>
        </View>
      )}

      <View className="flex-row justify-between py-1">
        <Text className="text-pos-sm text-pos-muted">Tax (11%)</Text>
        <Text className="text-pos-sm text-pos-text-strong">
          {formatIDR(order.tax_amount)}
        </Text>
      </View>

      {showServiceCharge && (
        <View className="flex-row justify-between py-1">
          <Text className="text-pos-sm text-pos-muted">Service</Text>
          <Text className="text-pos-sm text-pos-text-strong">
            {formatIDR(order.service_charge)}
          </Text>
        </View>
      )}

      {showRounding && (
        <View className="flex-row justify-between py-1">
          <Text className="text-pos-sm text-pos-muted">Rounding</Text>
          <Text className="text-pos-sm text-pos-text-strong">
            {order.rounding_amount > 0 ? '+' : ''}{formatIDR(order.rounding_amount)}
          </Text>
        </View>
      )}

      <View className="mt-2 flex-row justify-between border-t border-white/10 pt-2">
        <Text className="text-pos-lg font-bold text-pos-text-strong">Total</Text>
        <Text className="text-pos-2xl font-bold text-toast-orange-3">
          {formatIDR(order.total)}
        </Text>
      </View>
    </View>
  );
}
