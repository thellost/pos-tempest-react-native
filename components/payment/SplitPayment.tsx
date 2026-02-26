import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { formatIDR } from '@/utils/currency';

/** A single payment entry not yet committed to the database */
export interface PendingPayment {
  /** Local UUID for list key / removal */
  id: string;
  method: PaymentMethodType;
  /** Amount tendered */
  amount: number;
  /** Optional reference number (card slip, QRIS txn ID, etc.) */
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

/**
 * Displays the list of pending (not yet committed) payment entries,
 * plus a summary row showing the remaining balance or change amount.
 *
 * Returns null if no payments have been added yet.
 */
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
    <View
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Payment rows */}
      {payments.map((payment, index) => {
        const color = METHOD_COLORS[payment.method] ?? '#94A3B8';
        return (
          <View
            key={payment.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor:
                index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
              borderTopWidth: index > 0 ? 1 : 0,
              borderTopColor: 'rgba(255,255,255,0.05)',
            }}
          >
            {/* Color dot */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
                marginRight: 8,
              }}
            />

            {/* Method label */}
            <Text
              style={{ flex: 1, fontSize: 12, fontWeight: '700', color }}
            >
              {METHOD_LABELS[payment.method] ?? payment.method}
            </Text>

            {/* Reference number */}
            {payment.referenceNumber ? (
              <Text
                style={{
                  fontSize: 11,
                  color: '#64748B',
                  marginRight: 8,
                  maxWidth: 80,
                }}
                numberOfLines={1}
              >
                #{payment.referenceNumber}
              </Text>
            ) : null}

            {/* Amount */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: '#F8FAFC',
                marginRight: 10,
              }}
            >
              {formatIDR(payment.amount)}
            </Text>

            {/* Remove button */}
            <Pressable
              onPress={() => onRemove(payment.id)}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={{ fontSize: 14, color: '#EF4444', fontWeight: '700' }}>✕</Text>
            </Pressable>
          </View>
        );
      })}

      {/* Summary row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: 'rgba(0,0,0,0.25)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {remaining > 0 ? (
          <>
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Remaining</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#F59E0B' }}>
              {formatIDR(remaining)}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Change</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>
              {formatIDR(change)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
});
