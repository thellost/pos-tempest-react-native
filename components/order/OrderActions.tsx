import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ORDER_STATUS } from '@/constants/enums';
import type { OrderStatus } from '@/constants/enums';

interface OrderActionsProps {
  orderStatus: OrderStatus;
  hasItems: boolean;
  sentAt?: string | null;
  onSendToKitchen: () => void;
  onHold: () => void;
  onPayment: () => void;
}

export function OrderActions({
  orderStatus,
  hasItems,
  sentAt,
  onSendToKitchen,
  onHold,
  onPayment,
}: OrderActionsProps) {
  const isPending = orderStatus === ORDER_STATUS.PENDING;
  const canSend = hasItems && isPending;
  const canPayment = hasItems && orderStatus !== ORDER_STATUS.CANCELLED;

  const handleSendToKitchen = useCallback(() => {
    if (canSend) {
      onSendToKitchen();
    }
  }, [canSend, onSendToKitchen]);

  const handleHold = useCallback(() => {
    if (hasItems) {
      onHold();
    }
  }, [hasItems, onHold]);

  const handlePayment = useCallback(() => {
    if (canPayment) {
      onPayment();
    }
  }, [canPayment, onPayment]);

  return (
    <View className="border-t border-border bg-surface-card p-3">
      <View className="flex-row gap-2">
        <Pressable
          onPress={handleHold}
          disabled={!hasItems}
          className="flex-1 items-center justify-center py-2.5"
          style={({ pressed }) => ({
            borderRadius: 8,
            backgroundColor: hasItems ? '#222838' : '#1A1F2C',
            opacity: !hasItems ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Text className={`text-pos-sm font-semibold ${hasItems ? 'text-pos-text' : 'text-pos-text-faint'}`}>
            Hold
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSendToKitchen}
          disabled={!canSend}
          className="flex-1 items-center justify-center py-2.5"
          style={({ pressed }) => ({
            borderRadius: 8,
            backgroundColor: canSend ? '#6366F1' : '#1A1F2C',
            opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Text className={`text-pos-sm font-semibold ${canSend ? 'text-white' : 'text-pos-text-faint'}`}>
            {sentAt ? `Sent ${sentAt}` : 'Kitchen'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handlePayment}
        disabled={!canPayment}
        className="mt-2 items-center justify-center py-3"
        style={({ pressed }) => ({
          borderRadius: 8,
          backgroundColor: canPayment ? '#10B981' : '#1A1F2C',
          opacity: !canPayment ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Text className={`text-pos-base font-bold ${canPayment ? 'text-white' : 'text-pos-text-faint'}`}>
          Payment
        </Text>
      </Pressable>
    </View>
  );
}
