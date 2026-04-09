import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHODS } from '@/constants/payment';
import { useLayout } from '@/hooks/use-layout';

interface PaymentMethodSelectorProps {
  selected: PaymentMethodType | null;
  onSelect: (method: PaymentMethodType) => void;
}

export const PaymentMethodSelector = memo(function PaymentMethodSelector({
  selected,
  onSelect,
}: PaymentMethodSelectorProps) {
  const { isPhone } = useLayout();

  return (
    <View className={isPhone ? 'flex-row flex-wrap gap-1.5' : 'flex-row gap-1.5'}>
      {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => {
        const isSelected = selected === method;
        return (
          <Pressable
            key={method}
            onPress={() => onSelect(method)}
            className="items-center justify-center rounded-lg border border-border py-2"
            style={({ pressed }) => ({
              width: isPhone ? '48%' : undefined,
              flex: isPhone ? undefined : 1,
              backgroundColor: isSelected ? `${color}22` : undefined,
              borderColor: isSelected ? color : undefined,
              borderWidth: isSelected ? 1.5 : 1,
              opacity: pressed ? 0.7 : 1,
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
