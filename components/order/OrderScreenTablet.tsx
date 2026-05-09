import { Text, View } from 'react-native';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { MenuSearchBar } from '@/components/menu/MenuSearchBar';
import { OrderPanel } from '@/components/order/OrderPanel';
import { PerfProfiler } from '@/utils/perf-debug';

import type { OrderScreenSharedProps } from './order-screen-props';

/**
 * Side-by-side tablet layout: OrderPanel (flex 3) | Menu (flex 7).
 * Identical to the original order screen layout — no regressions.
 */
export function OrderScreenTablet({
  title,
  order,
  itemsForPanel,
  pendingRoundItemsDisplay,
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
  isShiftOpen,
  assignedCustomer,
  onAssignCustomer,
  onClearCustomer,
  guestName,
  onSetGuestName,
  onClearGuestName,
  topLevelCategories,
  subCategories,
  selectedCategoryId,
  selectedSubCategoryId,
  onSelectCategory,
  onSelectSubCategory,
  searchQuery,
  onSearchQueryChange,
  menuItemsList,
  allItemsForGrid,
  categoryById,
  quantitiesByMenuItemId,
  onMenuItemPress,
  onMenuItemDecrement,
  onMoveTable,
  isConfirming,
}: OrderScreenSharedProps) {
  return (
    <View className="flex-1 flex-row">
      {/* Left panel — order summary */}
      <View style={{ flex: 3 }}>
        <PerfProfiler id="OrderPanel">
          <OrderPanel
            order={order}
            items={itemsForPanel}
            guestCount={guestCount}
            onGuestCountChange={onGuestCountChange}
            onUpdateQuantity={onUpdateQuantity}
            onEditModifiers={onEditModifiers}
            onConfirmOrder={onConfirmOrder}
            onRemoveItem={onRemoveItem}
            onSendToKitchen={onSendToKitchen}
            onPayment={onPayment}
            onCancelOrder={onCancelOrder}
            pendingRoundItems={pendingRoundItemsDisplay}
            currentRound={currentRound}
            roundSentAt={roundSentAt}
            onConfirmRound={onConfirmRound}
            onCancelRound={onCancelRound}
            onPrintBill={onPrintBill}
            isShiftOpen={isShiftOpen}
            assignedCustomer={assignedCustomer}
            onAssignCustomer={onAssignCustomer}
            onClearCustomer={onClearCustomer}
            guestName={guestName}
            onSetGuestName={onSetGuestName}
            onClearGuestName={onClearGuestName}
            onMoveTable={onMoveTable}
            isConfirming={isConfirming}
          />
        </PerfProfiler>
      </View>

      {/* Right panel — menu browser */}
      <View style={{ flex: 7 }}>
        <View className="border-b border-border bg-surface-card px-4 py-3">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text className="text-pos-lg font-bold text-pos-text">{title}</Text>
              {order && (
                <Text className="text-pos-xs text-pos-text-muted">{order.order_number}</Text>
              )}
            </View>
            <View className="w-[52%]">
              <MenuSearchBar
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                className="mx-0 my-0"
              />
            </View>
            <View className="flex-1" />
          </View>
        </View>

        <PerfProfiler id="CategoryTabs">
          <CategoryTabs
            categories={topLevelCategories}
            subCategories={subCategories}
            selectedCategoryId={selectedCategoryId}
            selectedSubCategoryId={selectedSubCategoryId}
            onSelectCategory={onSelectCategory}
            onSelectSubCategory={onSelectSubCategory}
          />
        </PerfProfiler>

        <PerfProfiler id="MenuGrid">
          <MenuGrid
            items={menuItemsList}
            allItems={allItemsForGrid}
            categoryById={categoryById}
            quantitiesByMenuItemId={quantitiesByMenuItemId}
            onItemPress={onMenuItemPress}
            onDecrementItem={onMenuItemDecrement}
          />
        </PerfProfiler>
      </View>
    </View>
  );
}
