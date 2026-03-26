import type React from 'react';
import { FileText, Receipt } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/constants/enums';
import type { Order } from '@/db/models';
import type { KOTWithItems } from '@/services/kitchen.service';

type OrderRow = Order & { table_number: string | null; branch_name: string | null };

interface Props {
  order: OrderRow;
  kots: KOTWithItems[];
  onViewReceipt: () => void;
  onViewKOT: () => void;
}

const ORDER_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  [ORDER_STATUS.COMPLETED]: { bg: ThemeColors.success.dim,   text: ThemeColors.success.DEFAULT },
  [ORDER_STATUS.CANCELLED]: { bg: ThemeColors.danger.muted,  text: ThemeColors.danger.DEFAULT  },
};
const DEFAULT_ORDER_STATUS_STYLE = {
  bg: ThemeColors.accent.primaryMuted,
  text: ThemeColors.accent.primary,
};

const PAYMENT_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  [PAYMENT_STATUS.PAID]:    { bg: ThemeColors.success.dim,   text: ThemeColors.success.DEFAULT  },
  [PAYMENT_STATUS.PARTIAL]: { bg: ThemeColors.warning.muted, text: ThemeColors.warning.DEFAULT  },
};
const DEFAULT_PAYMENT_STATUS_STYLE = {
  bg: ThemeColors.danger.muted,
  text: ThemeColors.danger.DEFAULT,
};

export function ViewOnlyPanel({ order, kots, onViewReceipt, onViewKOT }: Props) {
  const orderStyle  = ORDER_STATUS_STYLE[order.status]          ?? DEFAULT_ORDER_STATUS_STYLE;
  const payStyle    = PAYMENT_STATUS_STYLE[order.payment_status ?? ''] ?? DEFAULT_PAYMENT_STATUS_STYLE;

  return (
    <View style={{ flex: 1 }} className="border-l border-border">
      <View className="flex-1 items-center justify-center px-6" style={{ gap: 16 }}>
        <SectionCard>
          <Text className="mb-2 text-[11px] font-bold tracking-widest text-pos-text-faint">
            ORDER STATUS
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="rounded-lg px-3 py-1.5" style={{ backgroundColor: orderStyle.bg }}>
              <Text className="text-pos-sm font-extrabold" style={{ color: orderStyle.text }}>
                {order.status.toUpperCase()}
              </Text>
            </View>
            <View className="rounded-lg px-3 py-1.5" style={{ backgroundColor: payStyle.bg }}>
              <Text className="text-pos-sm font-extrabold" style={{ color: payStyle.text }}>
                {order.payment_status?.toUpperCase() ?? 'UNPAID'}
              </Text>
            </View>
          </View>
        </SectionCard>

        <Button
          onPress={onViewReceipt}
          className="w-full h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface-card"
        >
          <Receipt size={18} color={ThemeColors.accent.primary} />
          <Text className="text-pos-base font-bold" style={{ color: ThemeColors.accent.primary }}>
            View Receipt / Bill
          </Text>
        </Button>

        <Button
          onPress={onViewKOT}
          className="w-full h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface-card"
        >
          <FileText size={18} color={ThemeColors.text.muted} />
          <Text className="text-pos-base font-bold text-pos-text-muted">
            {kots.length > 1 ? `View KOT (${kots.length} rounds)` : 'View KOT'}
          </Text>
        </Button>
      </View>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-border bg-surface-card p-3">{children}</View>
  );
}
