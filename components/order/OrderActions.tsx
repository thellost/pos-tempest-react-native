import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OrderStatus } from '@/constants/enums';
import { ORDER_STATUS } from '@/constants/enums';

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
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={handleCancelRound}
            className="h-10 flex-1 items-center justify-center rounded-sm border border-pos-danger bg-pos-danger-muted"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text className="text-pos-xs font-semibold text-pos-danger">
              Cancel Round
            </Text>
          </Pressable>

          <Pressable
            onPress={onPrintBill}
            className="h-10 flex-1 items-center justify-center rounded-sm border border-border bg-surface-raised"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text className="text-pos-xs font-semibold text-pos-text-muted">
              Print Bill
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleConfirmRound}
          className="mt-1.5 h-10 items-center justify-center rounded-sm border border-accent bg-accent"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text className="text-pos-sm font-bold text-white">
            Confirm Round
          </Text>
        </Pressable>
      </View>
    );
  }

  // Confirmed/Active State
  if (isActiveOrder) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={handleCancelOrder}
            disabled={!hasItems}
            className={`h-10 flex-1 items-center justify-center rounded-sm border ${
              hasItems
                ? 'border-pos-danger bg-pos-danger-muted'
                : 'border-border bg-surface-raised'
            }`}
            style={({ pressed }) => ({
              opacity: !hasItems ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && hasItems ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-xs font-semibold ${hasItems ? 'text-pos-danger' : 'text-pos-text-faint'}`}>
              Cancel Order
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSendToKitchen}
            disabled={!canSend}
            className={`h-10 flex-1 items-center justify-center rounded-sm border ${
              canSend ? 'border-accent bg-accent' : 'border-border bg-surface-raised'
            }`}
            style={({ pressed }) => ({
              opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && canSend ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-xs font-semibold ${canSend ? 'text-white' : 'text-pos-text-faint'}`}>
              Print KOT
            </Text>
            {sentAt ? (
              <Text className="mt-0.5 text-[9px] text-white/70">✓ {sentAt}</Text>
            ) : null}
          </Pressable>
        </View>

        <View className="mt-1.5 flex-row gap-1.5">
          <Pressable
            onPress={onPrintBill}
            className="h-10 flex-1 items-center justify-center rounded-sm border border-border bg-surface-raised"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text className="text-pos-xs font-semibold text-pos-text-muted">
              Print Bill
            </Text>
          </Pressable>

          <Pressable
            onPress={handlePayment}
            disabled={!canPayment}
            className={`h-10 flex-1 items-center justify-center rounded-sm border ${
              canPayment
                ? 'border-pos-success bg-pos-success'
                : 'border-border bg-surface-raised'
            }`}
            style={({ pressed }) => ({
              opacity: !canPayment ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && canPayment ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-sm font-bold ${canPayment ? 'text-white' : 'text-pos-text-faint'}`}>
              Payment
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Draft state — Confirm Order CTA
  if (showConfirmButton) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <Pressable
          onPress={onConfirmOrder}
          disabled={!hasItems}
          className={`h-12 items-center justify-center rounded-sm border ${
            hasItems ? 'border-accent bg-accent' : 'border-border bg-surface-raised'
          }`}
          style={({ pressed }) => ({
            opacity: !hasItems ? 0.4 : pressed ? 0.7 : 1,
            transform: [{ scale: pressed && hasItems ? 0.98 : 1 }],
          })}
        >
          <Text className={`text-pos-sm font-bold ${hasItems ? 'text-white' : 'text-pos-text-faint'}`}>
            Confirm Order
          </Text>
        </Pressable>
      </View>
    );
  }

  // Fallback
  return (
    <View className="border-t border-border bg-surface-card p-2">
      <Pressable
        onPress={handlePayment}
        disabled={!canPayment}
        className={`h-10 items-center justify-center rounded-sm border ${
          canPayment
            ? 'border-pos-success bg-pos-success'
            : 'border-border bg-surface-raised'
        }`}
        style={({ pressed }) => ({
          opacity: !canPayment ? 0.4 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed && canPayment ? 0.98 : 1 }],
        })}
      >
        <Text className={`text-pos-sm font-bold ${canPayment ? 'text-white' : 'text-pos-text-faint'}`}>
          Payment
        </Text>
      </Pressable>
    </View>
  );
}
