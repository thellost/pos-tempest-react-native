import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_TYPE } from '@/constants/enums';
import { PaymentColors } from '@/constants/theme';

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

export const PaymentMethodSelector = memo(function PaymentMethodSelector({
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  return (
    <View className="flex-row gap-1.5">
      {PAYMENT_METHODS.map(({ method, label, emoji, activeColor }) => {
        const isSelected = selected === method;
        return (
          <Pressable
            key={method}
            onPress={() => onSelect(method)}
            className="flex-1 items-center justify-center rounded-lg border border-border py-2"
            style={({ pressed }) => ({
              backgroundColor: isSelected ? `${activeColor}22` : undefined,
              borderColor: isSelected ? activeColor : undefined,
              borderWidth: isSelected ? 1.5 : 1,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 15 }}>{emoji}</Text>
            <Text
              className={`mt-0.5 text-[10px] font-bold ${isSelected ? '' : 'text-pos-text-muted'}`}
              style={isSelected ? { color: activeColor } : undefined}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
