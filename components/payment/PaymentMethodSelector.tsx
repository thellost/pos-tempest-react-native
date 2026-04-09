import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHODS } from '@/constants/payment';
import { withPressedOpacity } from '@/utils/pressable-style';

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
      {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => {
        const isSelected = selected === method;
        return (
          <Pressable
            key={method}
            onPress={() => onSelect(method)}
            className="flex-1 items-center justify-center rounded-lg border border-border py-2"
            style={({ pressed }) => ({
              backgroundColor: isSelected ? `${color}22` : undefined,
              borderColor: isSelected ? color : undefined,
              borderWidth: isSelected ? 1.5 : 1,
              ...withPressedOpacity(pressed),
            })}
          >
            <Icon size={20} color={color} />
            <Text
              className={`mt-0.5 text-[10px] font-bold ${isSelected ? '' : 'text-pos-text-muted'}`}
              style={isSelected ? { color } : undefined}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
