import { Pressable, Text, View } from 'react-native';
import { Clock, ShoppingBag, Users } from 'lucide-react-native';

import type { DailyOrderRow } from '@/hooks/use-daily-orders';
import { ThemeColors } from '@/constants/theme';
import { formatIDR } from '@/utils/currency';
import { formatTime } from '@/utils/date';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: ThemeColors.warning.DEFAULT,  bg: ThemeColors.warning.muted },
  confirmed:  { label: 'Confirmed',  color: ThemeColors.accent.primary,   bg: ThemeColors.accent.primaryMuted },
  preparing:  { label: 'Preparing',  color: ThemeColors.accent.primary,   bg: ThemeColors.accent.primaryMuted },
  ready:      { label: 'Ready',      color: ThemeColors.success.DEFAULT,  bg: ThemeColors.success.muted },
  served:     { label: 'Served',     color: ThemeColors.success.DEFAULT,  bg: ThemeColors.success.muted },
  completed:  { label: 'Completed',  color: ThemeColors.success.DEFAULT,  bg: ThemeColors.success.dim },
  cancelled:  { label: 'Cancelled',  color: ThemeColors.danger.DEFAULT,   bg: ThemeColors.danger.muted },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unpaid:   { label: 'Unpaid',   color: ThemeColors.danger.DEFAULT,  bg: ThemeColors.danger.muted },
  partial:  { label: 'Partial',  color: ThemeColors.warning.DEFAULT, bg: ThemeColors.warning.muted },
  paid:     { label: 'Paid',     color: ThemeColors.success.DEFAULT, bg: ThemeColors.success.muted },
  refunded: { label: 'Refunded', color: ThemeColors.text.muted,      bg: ThemeColors.surfaces.raised },
};

interface OrderRowProps {
  order: DailyOrderRow;
  onPress: () => void;
}

export function OrderRow({ order, onPress }: OrderRowProps) {
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const payment = PAYMENT_CONFIG[order.payment_status] ?? PAYMENT_CONFIG.unpaid;
  const isTakeaway = order.order_type === 'takeaway';

  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg border border-border bg-surface-card px-4 py-3 active:bg-surface-raised"
    >
      {/* Top row: order number + time */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="font-mono text-pos-base font-bold text-pos-text">
            {order.order_number}
          </Text>
          {isTakeaway ? (
            <View className="flex-row items-center gap-1 rounded px-2 py-0.5" style={{ backgroundColor: ThemeColors.warning.muted }}>
              <ShoppingBag size={10} color={ThemeColors.warning.DEFAULT} />
              <Text className="text-[10px] font-bold" style={{ color: ThemeColors.warning.DEFAULT }}>
                TAKEAWAY
              </Text>
            </View>
          ) : order.table_number ? (
            <View className="rounded px-2 py-0.5" style={{ backgroundColor: ThemeColors.accent.primaryMuted }}>
              <Text className="text-[10px] font-bold" style={{ color: ThemeColors.accent.primary }}>
                Table {order.table_number}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1">
          <Clock size={12} color={ThemeColors.text.faint} />
          <Text className="font-mono text-pos-xs text-pos-text-faint">
            {formatTime(order.created_at)}
          </Text>
        </View>
      </View>

      {/* Middle row: customer, guests, cashier */}
      <View className="mt-1.5 flex-row items-center gap-3">
        {order.customer_name && (
          <Text className="text-pos-xs text-pos-text-muted" numberOfLines={1}>
            {order.customer_name}
          </Text>
        )}
        {!isTakeaway && order.guest_count ? (
          <View className="flex-row items-center gap-0.5">
            <Users size={10} color={ThemeColors.text.faint} />
            <Text className="text-pos-xs text-pos-text-faint">{order.guest_count}</Text>
          </View>
        ) : null}
        {order.cashier_name && (
          <Text className="text-pos-xs text-pos-text-faint" numberOfLines={1}>
            by {order.cashier_name}
          </Text>
        )}
      </View>

      {/* Bottom row: status badges + total */}
      <View className="mt-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="rounded px-2 py-0.5" style={{ backgroundColor: status.bg }}>
            <Text className="text-[10px] font-bold" style={{ color: status.color }}>
              {status.label.toUpperCase()}
            </Text>
          </View>
          <View className="rounded px-2 py-0.5" style={{ backgroundColor: payment.bg }}>
            <Text className="text-[10px] font-bold" style={{ color: payment.color }}>
              {payment.label.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text className="font-mono text-pos-base font-bold text-pos-text">
          {formatIDR(typeof order.total === 'number' ? order.total : parseFloat(String(order.total)) || 0)}
        </Text>
      </View>
    </Pressable>
  );
}
