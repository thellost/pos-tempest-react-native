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
import { PermissionGate } from '@/components/ui/PermissionGate';
import { PERMISSION } from '@/constants/permissions';

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
  /**
   * @deprecated Shifts are auto-managed and never block order actions.
   * Kept for interface stability; treated as informational only. Defaults to `true`.
   */
  isShiftOpen?: boolean;
  showConfirmButton?: boolean;
  isConfirming?: boolean;
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
  isConfirming = false,
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

          <PermissionGate permission={PERMISSION.PROCESS_PAYMENT}>
            <SecondaryButton onPress={onPrintBill} className="flex-1">
              <Text className="text-pos-xs font-semibold text-pos-text-muted">
                Print Bill
              </Text>
            </SecondaryButton>
          </PermissionGate>
        </View>

        <PrimaryButton onPress={handleConfirmRound} disabled={isConfirming} className="mt-1">
          <Text className="text-pos-sm font-bold text-white">
            {isConfirming ? 'Confirming...' : 'Confirm Round'}
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
          <PermissionGate permission={PERMISSION.CANCEL_ORDER}>
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
          </PermissionGate>

          <PermissionGate permission={PERMISSION.PRINT_KOT}>
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
          </PermissionGate>
        </View>

        <View className="mt-1 flex-row gap-1">
          <PermissionGate permission={PERMISSION.PROCESS_PAYMENT}>
            <SecondaryButton onPress={onPrintBill} className="flex-1">
              <Text className="text-pos-xs font-semibold text-pos-text-muted">
                Print Bill
              </Text>
            </SecondaryButton>
          </PermissionGate>

          <PermissionGate permission={PERMISSION.PROCESS_PAYMENT}>
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
          </PermissionGate>
        </View>
      </View>
    );
  }

  // Draft state — Confirm Order CTA
  if (showConfirmButton) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        {hasItems && !isConfirming ? (
          <PrimaryButton onPress={onConfirmOrder} size="lg">
            <Text className="text-pos-sm font-bold text-white">
              Confirm Order
            </Text>
          </PrimaryButton>
        ) : hasItems ? (
          <SecondaryButton onPress={onConfirmOrder} disabled size="lg">
            <Text className="text-pos-sm font-bold text-pos-text-faint">
              Confirming...
            </Text>
          </SecondaryButton>
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
      <PermissionGate permission={PERMISSION.PROCESS_PAYMENT}>
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
      </PermissionGate>
    </View>
  );
}
