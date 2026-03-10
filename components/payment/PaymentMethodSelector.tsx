import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_TYPE } from '@/constants/enums';
import { PaymentColors, ThemeColors } from '@/constants/theme';

interface PaymentMethodConfig {
  method: PaymentMethodType;
  label: string;
  emoji: string;
  activeColor: string;
}

const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { method: PAYMENT_METHOD_TYPE.CASH,          label: 'Cash',     emoji: '💵', activeColor: PaymentColors.cash },
  { method: PAYMENT_METHOD_TYPE.QRIS,          label: 'QRIS',     emoji: '📱', activeColor: PaymentColors.qris },
  { method: PAYMENT_METHOD_TYPE.DEBIT_CARD,    label: 'Debit',    emoji: '💳', activeColor: PaymentColors.debit },
  { method: PAYMENT_METHOD_TYPE.CREDIT_CARD,   label: 'Credit',   emoji: '💳', activeColor: PaymentColors.credit },
  { method: PAYMENT_METHOD_TYPE.EWALLET,       label: 'E-Wallet', emoji: '👛', activeColor: PaymentColors.eWallet },
  { method: PAYMENT_METHOD_TYPE.BANK_TRANSFER, label: 'Transfer', emoji: '🏦', activeColor: PaymentColors.bankTransfer },
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
                : ThemeColors.borders.subtle,
              borderWidth: 1.5,
              borderColor: isSelected ? activeColor : ThemeColors.borders.medium,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Text style={{ fontSize: 20, marginBottom: 3 }}>{emoji}</Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: isSelected ? activeColor : ThemeColors.text.muted,
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
