import { Fragment, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AlertTriangle, ArrowRightLeft, UtensilsCrossed } from 'lucide-react-native';

import { Button, SelectButton } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';

import type { OrderItemDisplay } from '@/components/order/types';
import { ORDER_STATUS, ORDER_TYPE } from '@/constants/enums';
import type { Order } from '@/db/models';
import { formatIDR } from '@/utils/currency';
import { formatTime } from '@/utils/date';
import { CustomerPickerRow, type AssignedCustomer } from './CustomerPickerRow';
import { OrderActions } from './OrderActions';
import { OrderItemRow } from './OrderItemRow';
import { OrderTotals } from './OrderTotals';
import { RoundDivider } from './RoundDivider';

interface OrderPanelProps {
  order: Order | null;
  items: OrderItemDisplay[];
  pendingRoundItems: OrderItemDisplay[];
  guestCount: number | null;
  currentRound: number;
  roundSentAt: Map<number, string>;
  onGuestCountChange: (count: number) => void;
  onUpdateQuantity: (itemId: number | string, newQuantity: number) => void;
  onEditModifiers: (itemId: number | string) => void;
  onConfirmOrder: () => void;
  onRemoveItem: (itemId: number | string) => void;
  onSendToKitchen: (round: number) => void;
  onPayment: () => void;
  onCancelOrder: () => void;
  onConfirmRound: () => void;
  onCancelRound: () => void;
  onPrintBill: () => void;
  /** Called when the user wants to move the order to a different table */
  onMoveTable?: () => void;
  /** When false, shows no-shift warning banner and disables action buttons */
  isShiftOpen?: boolean;
  /** Optionally assigned customer for this order */
  assignedCustomer?: AssignedCustomer | null;
  onAssignCustomer?: (customer: AssignedCustomer) => void;
  onClearCustomer?: () => void;
}

/**
 * Order panel component with round tracking support.
 * Displays order items grouped by round with visual dividers.
 */
export const OrderPanel = memo(function OrderPanel({
  order,
  items,
  pendingRoundItems,
  guestCount,
  currentRound,
  roundSentAt,
  onGuestCountChange,
  onUpdateQuantity,
  onEditModifiers,
  onConfirmOrder,
  onRemoveItem,
  onSendToKitchen,
  onPayment,
  onCancelOrder,
  onConfirmRound,
  onCancelRound,
  onPrintBill,
  onMoveTable,
  isShiftOpen = true,
  assignedCustomer = null,
  onAssignCustomer,
  onClearCustomer,
}: OrderPanelProps) {
  const activeItems = useMemo(() => items.filter(i => !i.is_voided), [items]);
  const hasItems = activeItems.length > 0;
  const hasPendingRound = pendingRoundItems.length > 0;
  const orderStatus = order?.status ?? ORDER_STATUS.PENDING;
  const isDineIn = order?.order_type === ORDER_TYPE.DINE_IN;
  const isTakeaway = order?.order_type === ORDER_TYPE.TAKEAWAY;
  const isConfirmed = orderStatus === ORDER_STATUS.CONFIRMED;
  const showConfirmButton = !isConfirmed && hasItems && isShiftOpen;

  // Which round to print — defaults to latest round, user can select older rounds.
  const [printRound, setPrintRound] = useState(currentRound);
  useEffect(() => {
    setPrintRound(currentRound);
  }, [currentRound]);

  // Wrap onSendToKitchen so it always uses the currently selected printRound.
  const handleSendToKitchenForRound = useCallback(() => {
    onSendToKitchen(printRound);
  }, [onSendToKitchen, printRound]);

  // Format the sent-at time for the selected print round.
  const currentRoundSentAt = roundSentAt.get(printRound);
  const sentAtFormatted: string | null = currentRoundSentAt
    ? (() => {
        try {
          return formatTime(currentRoundSentAt);
        } catch {
          return null;
        }
      })()
    : null;

  const handleGuestDecrease = useCallback(() => {
    if (guestCount !== null && guestCount > 0) {
      onGuestCountChange(guestCount - 1);
    }
  }, [guestCount, onGuestCountChange]);

  const handleGuestIncrease = useCallback(() => {
    if (guestCount !== null) {
      onGuestCountChange(guestCount + 1);
    }
  }, [guestCount, onGuestCountChange]);

  // Group items by round number
  const itemsByRound = useMemo(() => {
    const grouped = new Map<number, OrderItemDisplay[]>();
    
    for (const item of activeItems) {
      const round = item.round_number || 1;
      if (!grouped.has(round)) {
        grouped.set(round, []);
      }
      grouped.get(round)!.push(item);
    }
    
    return grouped;
  }, [activeItems]);

  // Rounds that have actual items in the DB (for the round selector).
  const availableRounds = useMemo(
    () => Array.from(itemsByRound.keys()).sort((a, b) => a - b),
    [itemsByRound]
  );

  // Render items with round dividers
  const renderedItemsWithRounds = useMemo(() => {
    const result: React.ReactNode[] = [];
    const rounds = Array.from(itemsByRound.keys()).sort((a, b) => a - b);

    for (const round of rounds) {
      const roundItems = itemsByRound.get(round) || [];
      
      // Add round divider (except for first round if no sent timestamp)
      if (round > 1 || roundSentAt.has(round)) {
        result.push(
          <RoundDivider
            key={`round-${round}`}
            roundNumber={round}
            sentAt={roundSentAt.get(round)}
          />
        );
      }

      // Group items by category within the round
      const grouped = roundItems.reduce<Record<string, OrderItemDisplay[]>>((accumulator, item) => {
        const groupName = item.category_group?.trim() || 'Lainnya';
        if (!accumulator[groupName]) {
          accumulator[groupName] = [];
        }
        accumulator[groupName].push(item);
        return accumulator;
      }, {});

      for (const [groupName, groupItems] of Object.entries(grouped)) {
        result.push(
          <Fragment key={`round-${round}-group-${groupName}`}>
            <View className="mb-1 mt-1 rounded-sm bg-surface-raised px-2 py-1">
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-pos-text-muted">
                {groupName}
              </Text>
            </View>

            {groupItems.map((item) => (
              <OrderItemRow
                key={`order-item-${item.id}`}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onEditModifiers={onEditModifiers}
                onRemove={onRemoveItem}
                locked={round < currentRound}
              />
            ))}
          </Fragment>
        );
      }
    }

    // Render pending round items
    if (pendingRoundItems.length > 0) {
      result.push(
        <RoundDivider
          key={`round-${currentRound}-pending`}
          roundNumber={currentRound}
          sentAt={null}
        />
      );

      const grouped = pendingRoundItems.reduce<Record<string, OrderItemDisplay[]>>((accumulator, item) => {
        const groupName = item.category_group?.trim() || 'Lainnya';
        if (!accumulator[groupName]) {
          accumulator[groupName] = [];
        }
        accumulator[groupName].push(item);
        return accumulator;
      }, {});

      for (const [groupName, groupItems] of Object.entries(grouped)) {
        result.push(
          <Fragment key={`round-${currentRound}-pending-group-${groupName}`}>
            <View className="mb-1 mt-1 rounded-sm bg-amber-500/20 px-2 py-1">
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-pos-price">
                {groupName} (PENDING)
              </Text>
            </View>

            {groupItems.map((item) => (
              <OrderItemRow
                key={`pending-item-${item.id}`}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onEditModifiers={onEditModifiers}
                onRemove={onRemoveItem}
              />
            ))}
          </Fragment>
        );
      }
    }

    return result;
  }, [itemsByRound, pendingRoundItems, currentRound, roundSentAt, onEditModifiers, onUpdateQuantity, onRemoveItem]);

  // Calculate totals including pending items
  const allItemsTotal = useMemo(
    () => [...activeItems, ...pendingRoundItems].reduce((sum, item) => sum + item.total, 0),
    [activeItems, pendingRoundItems]
  );

  return (
    <View className="flex-1 border-r border-border bg-surface-soft">
      <View className="border-b border-border bg-surface-card px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-mono text-pos-lg font-bold text-pos-text">
              {order?.order_number ?? 'New Order'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              className={`px-3 py-1.5 rounded-sm ${isDineIn ? 'bg-brand' : 'border border-border bg-transparent'}`}
            >
              <Text className={`text-pos-xs font-semibold ${isDineIn ? 'text-white' : 'text-pos-text-muted'}`}>
                Dine-in
              </Text>
            </Pressable>
            <Pressable
              className={`px-3 py-1.5 rounded-sm ${isTakeaway ? 'bg-brand' : 'border border-border bg-transparent'}`}
            >
              <Text className={`text-pos-xs font-semibold ${isTakeaway ? 'text-white' : 'text-pos-text-muted'}`}>
                Takeaway
              </Text>
            </Pressable>
          </View>
        </View>

        {onMoveTable && order && order.order_type === ORDER_TYPE.DINE_IN && (
          <View className="mt-2 flex-row justify-end">
            <Pressable
              onPress={onMoveTable}
              className="flex-row items-center gap-1 rounded-sm border border-border bg-surface-raised px-2.5 py-1.5"
            >
              <ArrowRightLeft size={12} color={ThemeColors.text.muted} />
              <Text className="text-pos-xs font-medium text-pos-text-muted">Move Table</Text>
            </Pressable>
          </View>
        )}

        {/* Customer picker */}
        {onAssignCustomer && onClearCustomer && (
          <CustomerPickerRow
            assignedCustomer={assignedCustomer}
            onAssign={onAssignCustomer}
            onClear={onClearCustomer}
            disabled={!isShiftOpen}
          />
        )}

        {guestCount !== null && (
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-pos-xs text-pos-text-muted">Guests</Text>
            <View className="flex-row items-center gap-2">
              <Button
                onPress={handleGuestDecrease}
                className="h-7 w-7 items-center justify-center rounded-sm bg-surface-raised"
              >
                <Text className="text-pos-sm text-pos-text">−</Text>
              </Button>
              <Text className="min-w-[24px] text-center text-pos-sm font-bold text-pos-text">
                {guestCount}
              </Text>
              <Button
                onPress={handleGuestIncrease}
                className="h-7 w-7 items-center justify-center rounded-sm bg-surface-raised"
              >
                <Text className="text-pos-sm text-pos-text">+</Text>
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* No-shift warning banner */}
      {!isShiftOpen && (
        <View
          className="flex-row items-center gap-2 border-b border-border px-4 py-2"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}
        >
          <AlertTriangle size={14} color={ThemeColors.warning.DEFAULT} />
          <Text className="text-pos-xs font-semibold text-pos-warning">
            No active shift — open a shift to create or modify orders
          </Text>
        </View>
      )}

      <ScrollView
        className="flex-1 px-3"
        contentContainerStyle={{ paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {activeItems.length === 0 && pendingRoundItems.length === 0 ? (
          <View className="items-center justify-center py-8">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-surface-card">
              <UtensilsCrossed size={24} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-sm text-pos-text-muted">No items added</Text>
            <Text className="mt-1 text-pos-xs text-pos-text-faint">
              Tap menu items to add
            </Text>
          </View>
        ) : (
          renderedItemsWithRounds
        )}
      </ScrollView>

      <View className="px-3">
        {order ? (
          <OrderTotals order={order} />
        ) : (
          <View className="border-t border-border py-2">
            <View className="flex-row justify-between">
              <Text className="text-pos-xs font-semibold text-pos-text-muted">Total</Text>
              <Text className="font-mono text-pos-lg font-bold text-accent">
                {formatIDR(allItemsTotal)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Round selector — shown when the order has items in 2 or more rounds */}
      {order && availableRounds.length > 1 && (
        <View className="flex-row items-center border-t border-border bg-surface-card px-3 py-1.5">
          <Text className="mr-2 text-pos-xs text-pos-text-muted">Ticket:</Text>
          {availableRounds.map((r) => (
            <SelectButton
              key={r}
              selected={printRound === r}
              selectedClassName="bg-accent"
              unselectedClassName="bg-surface-raised"
              className="mr-1 rounded px-2.5 py-1"
              onPress={() => setPrintRound(r)}
            >
              <Text
                className={`text-pos-xs font-bold ${printRound === r ? 'text-white' : 'text-pos-text-muted'}`}
              >
                R{r}
              </Text>
            </SelectButton>
          ))}
        </View>
      )}

      <OrderActions
        orderStatus={orderStatus}
        hasItems={hasItems}
        hasPendingRound={hasPendingRound}
        sentAt={sentAtFormatted}
        onConfirmOrder={onConfirmOrder}
        showConfirmButton={showConfirmButton}
        onSendToKitchen={handleSendToKitchenForRound}
        onCancelOrder={onCancelOrder}
        onPayment={onPayment}
        onConfirmRound={onConfirmRound}
        onCancelRound={onCancelRound}
        onPrintBill={onPrintBill}
        isShiftOpen={isShiftOpen}
      />
    </View>
  );
});
