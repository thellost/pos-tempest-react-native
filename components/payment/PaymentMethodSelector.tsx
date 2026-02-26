import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_TYPE } from '@/constants/enums';

interface PaymentMethodConfig {
  method: PaymentMethodType;
  label: string;
  emoji: string;
  activeColor: string;
}

const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { method: PAYMENT_METHOD_TYPE.CASH,          label: 'Cash',     emoji: '💵', activeColor: '#10B981' },
  { method: PAYMENT_METHOD_TYPE.QRIS,          label: 'QRIS',     emoji: '📱', activeColor: '#6366F1' },
  { method: PAYMENT_METHOD_TYPE.DEBIT_CARD,    label: 'Debit',    emoji: '💳', activeColor: '#3B82F6' },
  { method: PAYMENT_METHOD_TYPE.CREDIT_CARD,   label: 'Credit',   emoji: '💳', activeColor: '#F59E0B' },
  { method: PAYMENT_METHOD_TYPE.EWALLET,       label: 'E-Wallet', emoji: '👛', activeColor: '#EC4899' },
  { method: PAYMENT_METHOD_TYPE.BANK_TRANSFER, label: 'Transfer', emoji: '🏦', activeColor: '#8B5CF6' },
];

interface PaymentMethodSelectorProps {
  selected: PaymentMethodType | null;
  onSelect: (method: PaymentMethodType) => void;
}

/**
 * Grid of payment method buttons (6 methods, 3 per row).
 * Selected method is highlighted in its accent color.
 */
export const PaymentMethodSelector = memo(function PaymentMethodSelector({
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PAYMENT_METHODS.map(({ method, label, emoji, activeColor }) => {
        const isSelected = selected === method;

        return (
          <Pressable
            key={method}
            onPress={() => onSelect(method)}
            style={({ pressed }) => ({
              flexBasis: '31%',
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: isSelected
                ? `${activeColor}22`
                : 'rgba(255,255,255,0.04)',
              borderWidth: 1.5,
              borderColor: isSelected ? activeColor : 'rgba(255,255,255,0.08)',
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text style={{ fontSize: 20, marginBottom: 3 }}>{emoji}</Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: isSelected ? activeColor : '#94A3B8',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
