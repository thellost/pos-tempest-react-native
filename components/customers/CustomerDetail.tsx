import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Mail, Phone, X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { IconButton } from '@/components/ui';
import type { Customer } from '@/db/models';
import type { CustomerOrderHistory } from '@/hooks/use-customers';
import { formatIDR } from '@/utils/currency';
import { toInt } from '@/utils/coerce';

export interface CustomerDetailProps {
  customer: Customer;
  onClose: () => void;
  getOrderHistory: (id: number) => Promise<CustomerOrderHistory[]>;
}

export function CustomerDetail({ customer, onClose, getOrderHistory }: CustomerDetailProps) {
  const [orderHistory, setOrderHistory] = useState<CustomerOrderHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const customerId = toInt(customer.id);

  useEffect(() => {
    setHistoryLoading(true);
    getOrderHistory(customerId)
      .then(setOrderHistory)
      .catch(() => setOrderHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [customerId, getOrderHistory]);

  return (
    <View className="flex-1">
      <View className="border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-pos-2xl font-bold text-pos-text" numberOfLines={1}>
              {customer.name}
            </Text>
            {customer.phone ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Phone size={12} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">{customer.phone}</Text>
              </View>
            ) : null}
            {customer.email ? (
              <View className="flex-row items-center gap-1.5">
                <Mail size={12} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">{customer.email}</Text>
              </View>
            ) : null}
          </View>
          <IconButton size="lg" onPress={onClose} className="ml-4 rounded-full bg-surface-raised">
            <X size={18} color={ThemeColors.text.muted} />
          </IconButton>
        </View>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-brand/10 p-3">
            <Text className="text-pos-xs text-pos-text-muted">Loyalty Points</Text>
            <Text className="text-pos-2xl font-bold text-brand">
              {customer.loyalty_points.toLocaleString('id-ID')}
            </Text>
          </View>
          <View className="flex-1 rounded-xl bg-surface-raised p-3">
            <Text className="text-pos-xs text-pos-text-muted">Total Visits</Text>
            <Text className="text-pos-2xl font-bold text-pos-text">{customer.total_visits}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-surface-raised p-3">
            <Text className="text-pos-xs text-pos-text-muted">Total Spent</Text>
            <Text className="text-pos-lg font-bold text-pos-text">
              {formatIDR(customer.total_spent)}
            </Text>
          </View>
        </View>

        {customer.notes ? (
          <Text className="mt-3 text-pos-xs italic text-pos-text-muted">{customer.notes}</Text>
        ) : null}
      </View>

      <Text className="px-6 py-4 text-pos-base font-bold text-pos-text">Order History</Text>

      {historyLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : orderHistory.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-pos-sm text-pos-text-muted">No orders yet</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6">
          {orderHistory.map((order) => (
            <View
              key={order.id}
              className="mb-3 flex-row items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <View>
                <Text className="text-pos-sm font-semibold text-pos-text">
                  {order.order_number}
                </Text>
                <Text className="text-pos-xs capitalize text-pos-text-muted">
                  {order.order_type} · {order.status}
                </Text>
                <Text className="text-pos-xs text-pos-text-muted">
                  {new Date(order.created_at).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text className="text-pos-base font-bold text-pos-text">
                {formatIDR(order.total)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
