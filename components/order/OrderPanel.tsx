import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { ArrowRightLeft, UtensilsCrossed } from 'lucide-react-native';

import type { OrderItemDisplay } from '@/components/order/types';
import { Button, SelectButton } from '@/components/ui';
import { ORDER_STATUS, ORDER_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import type { Order } from '@/db/models';
import { useStableCallback } from '@/hooks/use-stable-callback';
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
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onEditModifiers: (itemId: string) => void;
  onConfirmOrder: () => void;
  onRemoveItem: (itemId: string) => void;
  onSendToKitchen: (round: number) => void;
  onPayment: () => void;
  onCancelOrder: () => void;
  onConfirmRound: () => void;
  onCancelRound: () => void;
  onPrintBill: () => void;
  /** Called when the user wants to move the order to a different table */
  onMoveTable?: () => void;
  /**
   * @deprecated Shifts are auto-managed and never block order actions.
   * Kept for interface stability; treated as informational only. Defaults to `true`.
   */
  isShiftOpen?: boolean;
  /** Optionally assigned customer for this order */
  assignedCustomer?: AssignedCustomer | null;
  onAssignCustomer?: (customer: AssignedCustomer) => void;
  onClearCustomer?: () => void;
  /** Free-text guest name (shown only when no registered customer is assigned) */
  guestName?: string | null;
  onSetGuestName?: (name: string) => void;
  onClearGuestName?: () => void;
}

type ListRow =
  | { type: 'round-divider'; roundNumber: number; sentAt?: string | null }
  | { type: 'group-header'; roundNumber: number; groupName: string; isPending: boolean }
  | { type: 'order-item'; item: OrderItemDisplay }
  | { type: 'pending-item'; item: OrderItemDisplay };

interface GroupHeaderProps {
  groupName: string;
  isPending: boolean;
}

const GroupHeader = memo(function GroupHeader({ groupName, isPending }: GroupHeaderProps) {
  return (
    <View className={`mb-1 mt-1 rounded-sm px-2 py-1 ${isPending ? 'bg-amber-500/20' : 'bg-surface-raised'}`}>
      <Text className={`text-[10px] font-semibold uppercase tracking-wider ${isPending ? 'text-pos-price' : 'text-pos-text-muted'}`}>
        {isPending ? `${groupName} (PENDING)` : groupName}
      </Text>
    </View>
  );
});

function groupItemsByCategory(items: OrderItemDisplay[]): [string, OrderItemDisplay[]][] {
  const groupedItems = new Map<string, OrderItemDisplay[]>();

  items.forEach((item) => {
    const groupName = item.category_group?.trim() || 'Lainnya';
    const existingItems = groupedItems.get(groupName);

    if (existingItems) {
      existingItems.push(item);
      return;
    }

    groupedItems.set(groupName, [item]);
  });

  return Array.from(groupedItems.entries());
}

function appendGroupedRows(
  rows: ListRow[],
  roundNumber: number,
  items: OrderItemDisplay[],
  isPending: boolean
): void {
  groupItemsByCategory(items).forEach(([groupName, groupItems]) => {
    rows.push({
      type: 'group-header',
      roundNumber,
      groupName,
      isPending,
    });

    groupItems.forEach((item) => {
      rows.push({
        type: isPending ? 'pending-item' : 'order-item',
        item,
      });
    });
  });
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
  guestName = null,
  onSetGuestName,
  onClearGuestName,
}: OrderPanelProps) {
  const activeItems = useMemo(() => items.filter((item) => !item.is_voided), [items]);
  const hasItems = activeItems.length > 0;
  const hasPendingRound = pendingRoundItems.length > 0;
  const hasCartRows = hasItems || hasPendingRound;
  const orderStatus = order?.status ?? ORDER_STATUS.PENDING;
  const isDineIn = order?.order_type === ORDER_TYPE.DINE_IN;
  const isTakeaway = order?.order_type === ORDER_TYPE.TAKEAWAY;
  const isConfirmed = orderStatus === ORDER_STATUS.CONFIRMED;
  const showConfirmButton = !isConfirmed && hasItems;

  const [printRound, setPrintRound] = useState(currentRound);
  useEffect(() => {
    setPrintRound(currentRound);
  }, [currentRound]);

  const stableUpdateQuantity = useStableCallback(onUpdateQuantity);
  const stableEditModifiers = useStableCallback(onEditModifiers);
  const stableRemoveItem = useStableCallback(onRemoveItem);

  const handleSendToKitchenForRound = useCallback(() => {
    onSendToKitchen(printRound);
  }, [onSendToKitchen, printRound]);

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

  const itemsByRound = useMemo(() => {
    const groupedItems = new Map<number, OrderItemDisplay[]>();

    activeItems.forEach((item) => {
      const roundNumber = item.round_number || 1;
      const existingItems = groupedItems.get(roundNumber);

      if (existingItems) {
        existingItems.push(item);
        return;
      }

      groupedItems.set(roundNumber, [item]);
    });

    return groupedItems;
  }, [activeItems]);

  const availableRounds = useMemo(
    () => Array.from(itemsByRound.keys()).sort((left, right) => left - right),
    [itemsByRound]
  );

  const listData = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];
    const rounds = Array.from(itemsByRound.keys()).sort((left, right) => left - right);

    rounds.forEach((roundNumber) => {
      const roundItems = itemsByRound.get(roundNumber) ?? [];

      if (roundNumber > 1 || roundSentAt.has(roundNumber)) {
        rows.push({
          type: 'round-divider',
          roundNumber,
          sentAt: roundSentAt.get(roundNumber),
        });
      }

      appendGroupedRows(rows, roundNumber, roundItems, false);
    });

    if (pendingRoundItems.length > 0) {
      rows.push({
        type: 'round-divider',
        roundNumber: currentRound,
        sentAt: null,
      });
      appendGroupedRows(rows, currentRound, pendingRoundItems, true);
    }

    return rows;
  }, [currentRound, itemsByRound, pendingRoundItems, roundSentAt]);

  const allItemsTotal = useMemo(
    () => [...activeItems, ...pendingRoundItems].reduce((sum, item) => sum + item.total, 0),
    [activeItems, pendingRoundItems]
  );

  const keyExtractor = useCallback((row: ListRow): string => {
    if (row.type === 'order-item') {
      return `item-${row.item.id}`;
    }

    if (row.type === 'pending-item') {
      return `pending-item-${row.item.id}`;
    }

    if (row.type === 'round-divider') {
      return `divider-${row.roundNumber}-${row.sentAt ?? 'pending'}`;
    }

    return `group-${row.roundNumber}-${row.groupName}-${row.isPending ? 'pending' : 'sent'}`;
  }, []);

  const getItemType = useCallback((row: ListRow) => row.type, []);

  const renderListItem = useCallback(({ item: row }: ListRenderItemInfo<ListRow>) => {
    if (row.type === 'round-divider') {
      return (
        <RoundDivider
          roundNumber={row.roundNumber}
          sentAt={row.sentAt}
        />
      );
    }

    if (row.type === 'group-header') {
      return (
        <GroupHeader
          groupName={row.groupName}
          isPending={row.isPending}
        />
      );
    }

    return (
        <OrderItemRow
          item={row.item}
          onUpdateQuantity={stableUpdateQuantity}
          onEditModifiers={stableEditModifiers}
          onRemove={stableRemoveItem}
        />
      );
  }, [stableEditModifiers, stableRemoveItem, stableUpdateQuantity]);

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

        {onAssignCustomer && onClearCustomer && (
          <CustomerPickerRow
            assignedCustomer={assignedCustomer}
            guestName={guestName}
            onAssign={onAssignCustomer}
            onClear={onClearCustomer}
            onSetGuestName={onSetGuestName}
            onClearGuestName={onClearGuestName}
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

      <View className="flex-1 px-3">
        {!hasCartRows ? (
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
          <FlashList
            data={listData}
            renderItem={renderListItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
            style={{ flex: 1 }}
          />
        )}
      </View>

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

      {order && availableRounds.length > 1 && (
        <View className="flex-row items-center border-t border-border bg-surface-card px-3 py-1.5">
          <Text className="mr-2 text-pos-xs text-pos-text-muted">Ticket:</Text>
          {availableRounds.map((roundNumber) => (
            <SelectButton
              key={roundNumber}
              selected={printRound === roundNumber}
              selectedClassName="bg-accent"
              unselectedClassName="bg-surface-raised"
              className="mr-1 rounded px-2.5 py-1"
              onPress={() => setPrintRound(roundNumber)}
            >
              <Text
                className={`text-pos-xs font-bold ${printRound === roundNumber ? 'text-white' : 'text-pos-text-muted'}`}
              >
                R{roundNumber}
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
      />
    </View>
  );
});
