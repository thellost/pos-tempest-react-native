import { useCallback } from 'react';
import { Text, View } from 'react-native';

import type { OrderStatus } from '@/constants/enums';
import { ORDER_STATUS } from '@/constants/enums';
import {
  DangerButton,
  PrimaryButton,
  SecondaryButton,
  SuccessButton,
} from '@/components/ui';

interface OrderActionsProps {
  orderStatus: OrderStatus;
  hasItems: boolean;
  hasPendingRound: boolean;
  sentAt?: string | null;
  onConfirmOrder: () => void;
  onSendToKitchen: () => void;
  onCancelOrder: () => void;
  onPayment: () => void;
  onConfirmRound: () => void;
  onCancelRound: () => void;
  onPrintBill: () => void;
  /** When false all mutating actions are replaced with a locked shift banner */
  isShiftOpen?: boolean;
  showConfirmButton?: boolean;
}

/**
 * Order action buttons with three-state system:
 * - Draft: Confirm Order button (in OrderPanel header)
 * - Confirmed (no pending): Cancel Order, Print KOT, Print Bill, Payment
 * - Pending Round: Confirm Round, Cancel Round, Print Bill
 */
export function OrderActions({
  orderStatus,
  hasItems,
  hasPendingRound,
  sentAt,
  onConfirmOrder,
  onSendToKitchen,
  onCancelOrder,
  onPayment,
  onConfirmRound,
  onCancelRound,
  onPrintBill,
  isShiftOpen = true,
  showConfirmButton = false,
}: OrderActionsProps) {
  const isActiveOrder =
    orderStatus === ORDER_STATUS.CONFIRMED ||
    orderStatus === ORDER_STATUS.PREPARING ||
    orderStatus === ORDER_STATUS.READY ||
    orderStatus === ORDER_STATUS.SERVED;

  const canSend = hasItems;
  const canPayment = hasItems && orderStatus !== ORDER_STATUS.CANCELLED;

  const handleSendToKitchen = useCallback(() => {
    if (canSend) onSendToKitchen();
  }, [canSend, onSendToKitchen]);

  const handleCancelOrder = useCallback(() => {
    if (hasItems) onCancelOrder();
  }, [hasItems, onCancelOrder]);

  const handlePayment = useCallback(() => {
    if (canPayment) onPayment();
  }, [canPayment, onPayment]);

  const handleConfirmRound = useCallback(() => {
    if (hasPendingRound) onConfirmRound();
  }, [hasPendingRound, onConfirmRound]);

  const handleCancelRound = useCallback(() => {
    if (hasPendingRound) onCancelRound();
  }, [hasPendingRound, onCancelRound]);

  // When no shift is open, show a locked banner
  if (!isShiftOpen) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View className="h-10 items-center justify-center rounded-sm border border-pos-warning bg-pos-warning-muted">
          <Text className="text-pos-xs font-semibold text-pos-warning">
            🔒 Open a shift to take order actions
          </Text>
        </View>
      </View>
    );
  }

  // Pending Round State
  if (isActiveOrder && hasPendingRound) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View className="flex-row gap-1">
          <DangerButton onPress={handleCancelRound} className="flex-1">
            <Text className="text-pos-xs font-semibold text-pos-danger">
              Cancel Round
            </Text>
          </DangerButton>

          <SecondaryButton onPress={onPrintBill} className="flex-1">
            <Text className="text-pos-xs font-semibold text-pos-text-muted">
              Print Bill
            </Text>
          </SecondaryButton>
        </View>

        <PrimaryButton onPress={handleConfirmRound} className="mt-1">
          <Text className="text-pos-sm font-bold text-white">
            Confirm Round
          </Text>
        </PrimaryButton>
      </View>
    );
  }

  // Confirmed/Active State
  if (isActiveOrder) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View className="flex-row gap-1">
          {hasItems ? (
            <DangerButton onPress={handleCancelOrder} className="flex-1">
              <Text className="text-pos-xs font-semibold text-pos-danger">
                Cancel Order
              </Text>
            </DangerButton>
          ) : (
            <SecondaryButton onPress={handleCancelOrder} disabled className="flex-1">
              <Text className="text-pos-xs font-semibold text-pos-text-faint">
                Cancel Order
              </Text>
            </SecondaryButton>
          )}

          {canSend ? (
            <PrimaryButton onPress={handleSendToKitchen} className="flex-1">
              <Text className="text-pos-xs font-semibold text-white">
                Print KOT
              </Text>
              {sentAt ? (
                <Text className="mt-0.5 text-[9px] text-white/70">✓ {sentAt}</Text>
              ) : null}
            </PrimaryButton>
          ) : (
            <SecondaryButton onPress={handleSendToKitchen} disabled className="flex-1">
              <Text className="text-pos-xs font-semibold text-pos-text-faint">
                Print KOT
              </Text>
              {sentAt ? (
                <Text className="mt-0.5 text-[9px] text-pos-text-faint/70">✓ {sentAt}</Text>
              ) : null}
            </SecondaryButton>
          )}
        </View>

        <View className="mt-1 flex-row gap-1">
          <SecondaryButton onPress={onPrintBill} className="flex-1">
            <Text className="text-pos-xs font-semibold text-pos-text-muted">
              Print Bill
            </Text>
          </SecondaryButton>

          {canPayment ? (
            <SuccessButton onPress={handlePayment} className="flex-1">
              <Text className="text-pos-sm font-bold text-white">
                Payment
              </Text>
            </SuccessButton>
          ) : (
            <SecondaryButton onPress={handlePayment} disabled className="flex-1">
              <Text className="text-pos-sm font-bold text-pos-text-faint">
                Payment
              </Text>
            </SecondaryButton>
          )}
        </View>
      </View>
    );
  }

  // Draft state — Confirm Order CTA
  if (showConfirmButton) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        {hasItems ? (
          <PrimaryButton onPress={onConfirmOrder} size="lg">
            <Text className="text-pos-sm font-bold text-white">
              Confirm Order
            </Text>
          </PrimaryButton>
        ) : (
          <SecondaryButton onPress={onConfirmOrder} disabled size="lg">
            <Text className="text-pos-sm font-bold text-pos-text-faint">
              Confirm Order
            </Text>
          </SecondaryButton>
        )}
      </View>
    );
  }

  // Fallback
  return (
    <View className="border-t border-border bg-surface-card p-2">
      {canPayment ? (
        <SuccessButton onPress={handlePayment}>
          <Text className="text-pos-sm font-bold text-white">
            Payment
          </Text>
        </SuccessButton>
      ) : (
        <SecondaryButton onPress={handlePayment} disabled>
          <Text className="text-pos-sm font-bold text-pos-text-faint">
            Payment
          </Text>
        </SecondaryButton>
      )}
    </View>
  );
}
