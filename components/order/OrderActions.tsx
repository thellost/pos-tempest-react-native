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
    <View className="border-t border-white/10 bg-surface-soft p-3">
      <View className="flex-row gap-2">
        <Pressable
          onPress={handleHold}
          disabled={!hasItems}
          className={`flex-1 items-center justify-center rounded-lg py-3 ${
            hasItems ? 'bg-toast-gray-2 active:opacity-80' : 'bg-toast-gray-3 opacity-50'
          }`}
        >
          <Text className={`text-pos-base font-semibold ${hasItems ? 'text-white' : 'text-white/50'}`}>
            Hold
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSendToKitchen}
          disabled={!canSend}
          className={`flex-1 items-center justify-center rounded-lg py-3 ${
            canSend ? 'bg-toast-orange-3 active:opacity-80' : 'bg-toast-gray-3 opacity-50'
          }`}
        >
          <Text className={`text-pos-base font-semibold ${canSend ? 'text-white' : 'text-white/50'}`}>
            {sentAt ? `Sent ${sentAt}` : 'Send to Kitchen'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handlePayment}
        disabled={!canPayment}
        className={`mt-2 items-center justify-center rounded-lg py-4 ${
          canPayment ? 'bg-pos-success active:opacity-80' : 'bg-toast-gray-3 opacity-50'
        }`}
      >
        <Text className={`text-pos-lg font-bold ${canPayment ? 'text-white' : 'text-white/50'}`}>
          Payment
        </Text>
      </Pressable>
    </View>
  );
}
