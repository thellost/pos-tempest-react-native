import { router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ClipboardList, Search, X } from 'lucide-react-native';

import { OrderRow } from '@/components/daily-orders/OrderRow';
import { ORDER_STATUS, ORDER_TYPE, PAYMENT_STATUS } from '@/constants/enums';
import type { OrderStatus } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { useDailyOrders } from '@/hooks/use-daily-orders';
import { printBill, printKOT } from '@/lib/printer';
import { getKOTsForOrder } from '@/services/kitchen.service';
import { getBillData } from '@/services/receipt.service';
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

  const handlePrintReceipt = useCallback(async (orderId: string) => {
    try {
      const order = orders.find((o) => String(o.id) === orderId);
      if (!order) return;
      if (order.status === ORDER_STATUS.CANCELLED) {
        Alert.alert('Cannot Print', 'Cancelled orders cannot be reprinted.');
        return;
      }
      const includePayments = order.payment_status === PAYMENT_STATUS.PAID;
      const billData = await getBillData(orderId, includePayments);
      await printBill('cashier', billData);
      Alert.alert('Printed', `Receipt for ${order.order_number} sent to printer.`);
    } catch (error) {
      console.error('[DailyOrders] Receipt reprint error:', error);
      Alert.alert('Print Error', error instanceof Error ? error.message : 'Failed to print receipt.');
    }
  }, [orders]);

  const handlePrintKOT = useCallback(async (orderId: string) => {
    try {
      const order = orders.find((o) => String(o.id) === orderId);
      if (!order) return;
      if (order.status === ORDER_STATUS.CANCELLED) {
        Alert.alert('Cannot Print', 'Cancelled orders cannot be reprinted.');
        return;
      }
      const kots = await getKOTsForOrder(orderId);
      if (kots.length === 0) {
        Alert.alert('No KOTs', 'This order has no kitchen tickets to reprint.');
        return;
      }
      const isTakeaway = order.order_type === ORDER_TYPE.TAKEAWAY;
      for (const kot of kots) {
        await printKOT('kitchen', {
          ticketNumber: kot.ticket_number,
          orderNumber: kot.order_number,
          roundNumber: kot.round_number,
          tableLabel: kot.table_number ?? 'N/A',
          customerName: kot.customer_name,
          time: new Date(kot.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          isTakeaway,
          items: kot.items.map((item) => ({
            name: item.menu_item_name,
            quantity: item.quantity,
            unitOfMeasure: item.unit_of_measure,
            weight: item.weight,
            modifiers: item.modifier_names,
            notes: item.notes,
          })),
        });
      }
      Alert.alert('Printed', `${kots.length} KOT(s) for ${order.order_number} sent to printer.`);
    } catch (error) {
      console.error('[DailyOrders] KOT reprint error:', error);
      Alert.alert('Print Error', error instanceof Error ? error.message : 'Failed to print KOTs.');
    }
  }, [orders]);

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
      <View className="border-b border-border bg-surface-card px-4 py-2">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-pos-2xl font-bold text-pos-text">Order History</Text>
            <Text className="text-pos-xs text-pos-text-faint">{getAppDateString()}</Text>
          </View>
        </View>

        {/* Summary stats — flex-1 so cards stretch evenly regardless of screen width */}
        <View className="mt-2 flex-row gap-2">
          <View className="flex-1 rounded-sm bg-surface-raised px-2 py-1.5 items-center">
            <Text className="text-pos-xs text-pos-text-muted">Total</Text>
            <Text className="font-mono text-pos-xl font-bold text-pos-text text-center">
              {summary.totalOrders}
            </Text>
          </View>
          <View className="flex-1 rounded-sm px-2 py-1.5 items-center" style={{ backgroundColor: ThemeColors.accent.primaryMuted }}>
            <Text className="text-pos-xs text-pos-text-muted">Active</Text>
            <Text className="font-mono text-pos-xl font-bold text-center" style={{ color: ThemeColors.accent.primary }}>
              {summary.activeCount}
            </Text>
          </View>
          <View className="flex-1 rounded-sm px-2 py-1.5 items-center" style={{ backgroundColor: ThemeColors.success.dim }}>
            <Text className="text-pos-xs text-pos-text-muted">Done</Text>
            <Text className="font-mono text-pos-xl font-bold text-center" style={{ color: ThemeColors.success.DEFAULT }}>
              {summary.completedCount}
            </Text>
          </View>
          <View className="flex-1 rounded-sm px-2 py-1.5 items-center" style={{ backgroundColor: ThemeColors.success.dim }}>
            <Text className="text-pos-xs text-pos-text-muted">Revenue</Text>
            <Text className="font-mono text-pos-base font-bold text-center" style={{ color: ThemeColors.success.DEFAULT }}>
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
              onPrintReceipt={handlePrintReceipt}
              onPrintKOT={handlePrintKOT}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
