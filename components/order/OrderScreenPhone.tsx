import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { MenuSearchBar } from '@/components/menu/MenuSearchBar';
import { OrderPanel } from '@/components/order/OrderPanel';
import { PerfProfiler } from '@/utils/perf-debug';

import type { OrderScreenSharedProps } from './order-screen-props';

type ActiveTab = 'menu' | 'cart';

/**
 * Full-screen phone layout with tab-based switching between Menu and Cart.
 *
 * Structure:
 *   ┌─────────────────────┐
 *   │ Title  ·  n items   │  compact header
 *   ├─────────────────────┤
 *   │   [Tab content]     │  flex-1 — full-width menu or order panel
 *   ├─────────────────────┤
 *   │  [Menu]  [Cart(n)]  │  sticky tab switcher
 *   └─────────────────────┘
 */
export function OrderScreenPhone({
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
}: OrderScreenSharedProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');

  const itemCount = useMemo(
    () =>
      itemsForPanel.filter((i) => !i.is_voided).length + pendingRoundItemsDisplay.length,
    [itemsForPanel, pendingRoundItemsDisplay],
  );

  // Auto-switch back to Menu when the cart becomes empty
  useEffect(() => {
    if (itemCount === 0) setActiveTab('menu');
  }, [itemCount]);

  return (
    <View className="flex-1 bg-surface">
      {/* Compact header */}
      <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-2">
        <Text className="flex-1 text-pos-base font-bold text-pos-text" numberOfLines={1}>
          {title}
        </Text>
        {itemCount > 0 && (
          <Text className="ml-3 text-pos-xs text-pos-text-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        )}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 'menu' ? (
          <View className="flex-1">
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

            <MenuSearchBar value={searchQuery} onChangeText={onSearchQueryChange} />

            <PerfProfiler id="MenuGrid">
              <MenuGrid
                items={menuItemsList}
                allItems={allItemsForGrid}
                categoryById={categoryById}
                quantitiesByMenuItemId={quantitiesByMenuItemId}
                onItemPress={onMenuItemPress}
                onDecrementItem={onMenuItemDecrement}
                disabled={!isShiftOpen}
              />
            </PerfProfiler>
          </View>
        ) : (
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
            />
          </PerfProfiler>
        )}
      </View>

      {/* Sticky tab switcher */}
      <View className="flex-row border-t border-border bg-surface-card">
        <Pressable
          className={`flex-1 items-center py-3 ${activeTab === 'menu' ? 'border-b-2 border-brand' : ''}`}
          onPress={() => setActiveTab('menu')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'menu' }}
        >
          <Text
            className={`text-pos-sm font-semibold ${activeTab === 'menu' ? 'text-brand' : 'text-pos-text-muted'}`}
          >
            Menu
          </Text>
        </Pressable>

        <Pressable
          className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 ${activeTab === 'cart' ? 'border-b-2 border-brand' : ''}`}
          onPress={() => setActiveTab('cart')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'cart' }}
        >
          <Text
            className={`text-pos-sm font-semibold ${activeTab === 'cart' ? 'text-brand' : 'text-pos-text-muted'}`}
          >
            Cart
          </Text>
          {itemCount > 0 && (
            <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1">
              <Text className="text-[10px] font-bold text-white">{itemCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
