import { memo } from 'react';
import { Text, View } from 'react-native';
import { IconButton } from '@/components/ui';

import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_COLOR, PAYMENT_METHOD_LABEL } from '@/constants/payment';
import { useLayout } from '@/hooks/use-layout';
import { formatIDR } from '@/utils/currency';

export interface PendingPayment {
  id: string;
  method: PaymentMethodType;
  amount: number;
  referenceNumber: string | null;
}

interface SplitPaymentProps {
  payments: PendingPayment[];
  orderTotal: number;
  onRemove: (id: string) => void;
}

export const SplitPayment = memo(function SplitPayment({
  payments,
  orderTotal,
  onRemove,
}: SplitPaymentProps) {
  const totalTendered = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, orderTotal - totalTendered);
  const change = Math.max(0, totalTendered - orderTotal);
  const { isPhone } = useLayout();
  const iconSize = isPhone ? 'md' : 'sm' as const;

  if (payments.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {payments.map((payment, index) => {
        const color = PAYMENT_METHOD_COLOR[payment.method] ?? '#94A3B8';
        return (
          <View
            key={payment.id}
            className={`flex-row items-center px-3 py-2.5 ${
              index > 0 ? 'border-t border-border' : ''
            } ${index % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-card'}`}
          >
            {/* Color dot */}
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 8 }}
            />

            {/* Method label */}
            <Text className="flex-1 text-pos-xs font-bold" style={{ color }}>
              {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
            </Text>

            {/* Reference number */}
            {payment.referenceNumber ? (
              <Text
                className="mr-2 text-pos-xs text-pos-text-muted"
                style={{ maxWidth: 80 }}
                numberOfLines={1}
              >
                #{payment.referenceNumber}
              </Text>
            ) : null}

            {/* Amount */}
            <Text className="mr-2.5 text-pos-sm font-extrabold text-pos-text">
              {formatIDR(payment.amount)}
            </Text>

            {/* Remove */}
            <IconButton
              size={iconSize}
              onPress={() => onRemove(payment.id)}
              hitSlop={8}
              className="bg-transparent"
            >
              <Text className="text-pos-sm font-bold text-pos-danger">✕</Text>
            </IconButton>
          </View>
        );
      })}

      {/* Summary row */}
      <View className="flex-row items-center justify-between border-t border-border bg-surface-elevated px-3 py-2">
        {remaining > 0 ? (
          <>
            <Text className="text-pos-xs text-pos-text-muted">Remaining</Text>
            <Text className="text-pos-sm font-extrabold text-pos-warning">
              {formatIDR(remaining)}
            </Text>
          </>
        ) : (
          <>
            <Text className="text-pos-xs text-pos-text-muted">Change</Text>
            <Text className="text-pos-sm font-extrabold text-pos-success">
              {formatIDR(change)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
});
