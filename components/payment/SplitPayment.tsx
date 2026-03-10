import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { formatIDR } from '@/utils/currency';

export interface PendingPayment {
  id: string;
  method: PaymentMethodType;
  amount: number;
  referenceNumber: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  cash:          'Cash',
  qris:          'QRIS',
  debit_card:    'Debit',
  credit_card:   'Credit',
  ewallet:       'E-Wallet',
  bank_transfer: 'Transfer',
};

const METHOD_COLORS: Record<string, string> = {
  cash:          '#10B981',
  qris:          '#6366F1',
  debit_card:    '#3B82F6',
  credit_card:   '#F59E0B',
  ewallet:       '#EC4899',
  bank_transfer: '#8B5CF6',
};

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

  if (payments.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {payments.map((payment, index) => {
        const color = METHOD_COLORS[payment.method] ?? '#94A3B8';
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
              {METHOD_LABELS[payment.method] ?? payment.method}
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
            <Pressable
              onPress={() => onRemove(payment.id)}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text className="text-pos-sm font-bold text-pos-danger">✕</Text>
            </Pressable>
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
