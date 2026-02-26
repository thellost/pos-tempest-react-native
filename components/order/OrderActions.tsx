import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OrderStatus } from '@/constants/enums';
import { ORDER_STATUS } from '@/constants/enums';

interface OrderActionsProps {
  orderStatus: OrderStatus;
  hasItems: boolean;
  hasPendingRound: boolean;
  sentAt?: string | null;
  onSendToKitchen: () => void;
  onHold: () => void;
  onPayment: () => void;
  onConfirmRound: () => void;
  onCancelRound: () => void;
  onPrintBill: () => void;
  /** When false all mutating actions are replaced with a locked shift banner */
  isShiftOpen?: boolean;
}

/**
 * Order action buttons with three-state system:
 * - Draft: Confirm Order button (in OrderPanel header)
 * - Confirmed (no pending): Send to Kitchen, Print Bill, Hold, Payment
 * - Pending Round: Confirm Round, Cancel Round, Print Bill
 */
export function OrderActions({
  orderStatus,
  hasItems,
  hasPendingRound,
  sentAt,
  onSendToKitchen,
  onHold,
  onPayment,
  onConfirmRound,
  onCancelRound,
  onPrintBill,
  isShiftOpen = true,
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

  const handleConfirmRound = useCallback(() => {
    if (hasPendingRound) {
      onConfirmRound();
    }
  }, [hasPendingRound, onConfirmRound]);

  const handleCancelRound = useCallback(() => {
    if (hasPendingRound) {
      onCancelRound();
    }
  }, [hasPendingRound, onCancelRound]);

  const handlePrintBill = useCallback(() => {
    onPrintBill();
  }, [onPrintBill]);

  // When no shift is open, show a locked banner instead of action buttons
  if (!isShiftOpen) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View
          className="h-10 items-center justify-center rounded-sm"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.10)',
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.30)',
          }}
        >
          <Text className="text-pos-xs font-semibold text-pos-warning">
            🔒 Open a shift to take order actions
          </Text>
        </View>
      </View>
    );
  }

  // Pending Round State - show Confirm Round / Cancel Round buttons
  if (isConfirmed && hasPendingRound) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={handleCancelRound}
            className="h-10 flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.35)',
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text className="text-pos-xs font-semibold text-pos-danger">
              Cancel Round
            </Text>
          </Pressable>

          <Pressable
            onPress={handlePrintBill}
            className="h-10 flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: '#1A1F2C',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
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
          className="mt-1.5 h-10 items-center justify-center rounded-sm"
          style={({ pressed }) => ({
            backgroundColor: '#F59E0B',
            borderWidth: 1,
            borderColor: '#FBBF24',
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

  // Confirmed State (no pending round) - show standard action buttons
  if (isConfirmed) {
    return (
      <View className="border-t border-border bg-surface-card p-2">
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={handleHold}
            disabled={!hasItems}
            className="h-10 flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: hasItems ? 'rgba(245, 158, 11, 0.15)' : '#1A1F2C',
              borderWidth: 1,
              borderColor: hasItems ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.06)',
              opacity: !hasItems ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && hasItems ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-xs font-semibold ${hasItems ? 'text-pos-warning' : 'text-pos-text-faint'}`}>
              Hold
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSendToKitchen}
            disabled={!canSend}
            className="h-10 flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: canSend ? '#6366F1' : '#1A1F2C',
              borderWidth: 1,
              borderColor: canSend ? '#818CF8' : 'rgba(255, 255, 255, 0.06)',
              opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && canSend ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-xs font-semibold ${canSend ? 'text-pos-text-strong' : 'text-pos-text-faint'}`}>
              {sentAt ? `Sent ${sentAt}` : 'Kitchen'}
            </Text>
          </Pressable>
        </View>

        <View className="mt-1.5 flex-row gap-1.5">
          <Pressable
            onPress={handlePrintBill}
            className="h-10 flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: '#1A1F2C',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
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
            className="h-10 flex-1 items-center justify-center rounded-sm"
            style={({ pressed }) => ({
              backgroundColor: canPayment ? '#10B981' : '#1A1F2C',
              borderWidth: 1,
              borderColor: canPayment ? '#34D399' : 'rgba(255, 255, 255, 0.06)',
              opacity: !canPayment ? 0.4 : pressed ? 0.7 : 1,
              transform: [{ scale: pressed && canPayment ? 0.98 : 1 }],
            })}
          >
            <Text className={`text-pos-sm font-bold ${canPayment ? 'text-pos-text-strong' : 'text-pos-text-faint'}`}>
              Payment
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Draft state or other states - show minimal actions
  return (
    <View className="border-t border-border bg-surface-card p-2">
      <Pressable
        onPress={handlePayment}
        disabled={!canPayment}
        className="h-10 items-center justify-center rounded-sm"
        style={({ pressed }) => ({
          backgroundColor: canPayment ? '#10B981' : '#1A1F2C',
          borderWidth: 1,
          borderColor: canPayment ? '#34D399' : 'rgba(255, 255, 255, 0.06)',
          opacity: !canPayment ? 0.4 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed && canPayment ? 0.98 : 1 }],
        })}
      >
        <Text className={`text-pos-sm font-bold ${canPayment ? 'text-pos-text-strong' : 'text-pos-text-faint'}`}>
          Payment
        </Text>
      </Pressable>
    </View>
  );
}
