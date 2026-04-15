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
  const cardWidth = isPhone ? '48%' : '31%';

  return (
    <View className="flex-row flex-wrap gap-2">
      {PAYMENT_METHODS.map(({ method, label, icon: Icon, color }) => {
        const isSelected = selected === method;
        return (
          <Pressable
            key={method}
            onPress={() => onSelect(method)}
            className="items-center justify-center rounded-lg border border-border px-2 py-2"
            style={({ pressed }) => ({
              width: cardWidth,
              minHeight: 56,
              backgroundColor: isSelected ? `${color}22` : undefined,
              borderColor: isSelected ? color : undefined,
              borderWidth: isSelected ? 1.5 : 1,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon size={20} color={color} />
            <Text
              numberOfLines={1}
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
