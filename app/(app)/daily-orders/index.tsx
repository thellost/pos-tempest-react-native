import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ClipboardList, Search, X } from 'lucide-react-native';

import { OrderRow } from '@/components/daily-orders/OrderRow';
import { ORDER_STATUS } from '@/constants/enums';
import type { OrderStatus } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { useDailyOrders } from '@/hooks/use-daily-orders';
import { formatIDR } from '@/utils/currency';
import { getAppDateString } from '@/utils/date';

const STATUS_TABS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all',                        label: 'All' },
  { key: ORDER_STATUS.PENDING,         label: 'Pending' },
  { key: ORDER_STATUS.CONFIRMED,       label: 'Confirmed' },
  { key: ORDER_STATUS.PREPARING,       label: 'Preparing' },
  { key: ORDER_STATUS.READY,           label: 'Ready' },
  { key: ORDER_STATUS.SERVED,          label: 'Served' },
  { key: ORDER_STATUS.COMPLETED,       label: 'Completed' },
  { key: ORDER_STATUS.CANCELLED,       label: 'Cancelled' },
];

export default function DailyOrdersScreen() {
  const {
    orders,
    isLoading,
    summary,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
  } = useDailyOrders();

  const handleOrderPress = (order: (typeof orders)[number]) => {
    // Always open in view-only mode — no editing from Order History
    router.push({
      pathname: '/(app)/checkout/[orderId]',
      params: { orderId: String(order.id), viewOnly: '1' },
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading orders...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="border-b border-border bg-surface-card px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-pos-2xl font-bold text-pos-text">Order History</Text>
            <Text className="text-pos-xs text-pos-text-faint">{getAppDateString()}</Text>
          </View>
        </View>

        {/* Summary stats */}
        <View className="mt-3 flex-row items-center gap-2">
          <View className="w-24 rounded-sm bg-surface-raised px-3 py-2 items-center">
            <Text className="text-pos-xs text-pos-text-muted">Total</Text>
            <Text className="font-mono text-pos-xl font-bold text-pos-text text-center">
              {summary.totalOrders}
            </Text>
          </View>
          <View className="w-24 rounded-sm px-3 py-2 items-center" style={{ backgroundColor: ThemeColors.accent.primaryMuted }}>
            <Text className="text-pos-xs text-pos-text-muted">Active</Text>
            <Text className="font-mono text-pos-xl font-bold text-center" style={{ color: ThemeColors.accent.primary }}>
              {summary.activeCount}
            </Text>
          </View>
          <View className="w-24 rounded-sm px-3 py-2 items-center" style={{ backgroundColor: ThemeColors.success.dim }}>
            <Text className="text-pos-xs text-pos-text-muted">Done</Text>
            <Text className="font-mono text-pos-xl font-bold text-center" style={{ color: ThemeColors.success.DEFAULT }}>
              {summary.completedCount}
            </Text>
          </View>
          <View className="rounded-sm px-3 py-2 items-center" style={{ backgroundColor: ThemeColors.success.dim, minWidth: 120 }}>
            <Text className="text-pos-xs text-pos-text-muted">Revenue</Text>
            <Text className="font-mono text-pos-lg font-bold text-center" style={{ color: ThemeColors.success.DEFAULT }}>
              {formatIDR(summary.totalRevenue)}
            </Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View className="flex-row items-center gap-2 border-b border-border bg-surface-card px-4 py-2">
        <View className="flex-1 flex-row items-center rounded-lg border border-border bg-surface-raised px-3" style={{ height: 38 }}>
          <Search size={14} color={ThemeColors.text.faint} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search order number, customer, table..."
            placeholderTextColor={ThemeColors.text.faint}
            className="ml-2 flex-1 text-pos-sm text-pos-text"
            style={{ height: 38 }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={14} color={ThemeColors.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Status filter tabs */}
      <View className="border-b border-border bg-surface-card" style={{ height: 44 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setStatusFilter(tab.key)}
                className={`rounded-lg px-4 py-2 ${isActive ? 'bg-brand' : 'bg-surface-raised'}`}
              >
                <Text className={`text-pos-xs font-bold ${isActive ? 'text-white' : 'text-pos-text-muted'}`}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Order list */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 12, gap: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {orders.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
              <ClipboardList size={32} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-base text-pos-text-muted">
              {statusFilter !== 'all' || searchQuery
                ? 'No orders match your filters'
                : 'No orders today'}
            </Text>
            {(statusFilter !== 'all' || searchQuery) && (
              <Pressable
                onPress={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="mt-3 rounded-lg px-4 py-2"
                style={{ backgroundColor: ThemeColors.accent.primaryMuted }}
              >
                <Text className="text-pos-sm font-bold" style={{ color: ThemeColors.accent.primary }}>
                  Clear Filters
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          orders.map((order) => (
            <OrderRow
              key={String(order.id)}
              order={order}
              onPress={() => handleOrderPress(order)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
