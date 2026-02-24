import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OrderStatus } from '@/constants/enums';
import { ORDER_STATUS } from '@/constants/enums';

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
  const isConfirmed = orderStatus === ORDER_STATUS.CONFIRMED;
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
      {isConfirmed && (
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleHold}
            disabled={!hasItems}
            className="min-h-pos-touch flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: hasItems ? 'rgba(245, 158, 11, 0.15)' : '#1A1F2C',
              borderWidth: 1,
              borderColor: hasItems ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.06)',
              opacity: !hasItems ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && hasItems ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-sm font-semibold ${hasItems ? 'text-pos-warning' : 'text-pos-text-faint'}`}>
              Hold
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSendToKitchen}
            disabled={!canSend}
            className="min-h-pos-touch flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: canSend ? '#6366F1' : '#1A1F2C',
              borderWidth: 1,
              borderColor: canSend ? '#818CF8' : 'rgba(255, 255, 255, 0.06)',
              opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && canSend ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-sm font-semibold ${canSend ? 'text-pos-text-strong' : 'text-pos-text-faint'}`}>
              {sentAt ? `Sent ${sentAt}` : 'Kitchen'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={handlePayment}
        disabled={!canPayment}
        className="mt-2 min-h-pos-touch items-center justify-center rounded-sm"
        style={({ pressed }) => ({
          backgroundColor: canPayment ? '#10B981' : '#1A1F2C',
          borderWidth: 1,
          borderColor: canPayment ? '#34D399' : 'rgba(255, 255, 255, 0.06)',
          opacity: !canPayment ? 0.4 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed && canPayment ? 0.98 : 1 }],
        })}
      >
        <Text className={`text-pos-base font-bold ${canPayment ? 'text-pos-text-strong' : 'text-pos-text-faint'}`}>
          Payment
        </Text>
      </Pressable>
    </View>
  );
}
