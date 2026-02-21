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
    <View className="border-t border-border bg-surface-card p-4">
      <View className="flex-row gap-3">
        <Pressable
          onPress={handleHold}
          disabled={!hasItems}
          className={`flex-1 items-center justify-center py-3.5 ${
            hasItems ? 'bg-surface-raised' : 'bg-surface-raised opacity-40'
          }`}
          style={{ borderRadius: 12 }}
        >
          <Text className={`text-pos-base font-semibold ${hasItems ? 'text-pos-text' : 'text-pos-text-faint'}`}>
            Hold
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSendToKitchen}
          disabled={!canSend}
          className={`flex-1 items-center justify-center py-3.5 ${
            canSend ? 'bg-accent' : 'bg-surface-raised opacity-40'
          }`}
          style={{ borderRadius: 12 }}
        >
          <Text className={`text-pos-base font-semibold ${canSend ? 'text-white' : 'text-pos-text-faint'}`}>
            {sentAt ? `Sent ${sentAt}` : 'Send to Kitchen'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handlePayment}
        disabled={!canPayment}
        className={`mt-3 items-center justify-center py-4 ${
          canPayment ? 'bg-pos-success' : 'bg-surface-raised opacity-40'
        }`}
        style={{ borderRadius: 12 }}
      >
        <Text className={`text-pos-lg font-bold ${canPayment ? 'text-white' : 'text-pos-text-faint'}`}>
          Payment
        </Text>
      </Pressable>
    </View>
  );
}
