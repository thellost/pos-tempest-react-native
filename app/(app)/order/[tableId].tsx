import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { MenuSearchBar } from '@/components/menu/MenuSearchBar';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderPanel } from '@/components/order/OrderPanel';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import { useOrderScreen } from '@/hooks/use-order-screen';
import { PerfProfiler, useMountTimer } from '@/utils/perf-debug';
import { toInt, toIntOrNull } from '@/utils/coerce';

export default function OrderScreen() {
  const { tableId, orderId } = useLocalSearchParams<{ tableId: string; orderId?: string }>();

  if (!tableId || Array.isArray(tableId)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-pos-base text-pos-text-muted">Invalid table ID</Text>
      </View>
    );
  }

  return <OrderScreenContent tableId={tableId} orderId={orderId} />;
}

function OrderScreenContent({ tableId, orderId }: { tableId: string; orderId?: string }) {
  useMountTimer('OrderScreenContent');

  const screen = useOrderScreen({
    orderType: 'dine-in',
    tableId: toInt(tableId),
    orderId: toIntOrNull(orderId),
  });

  if (screen.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading order...</Text>
      </View>
    );
  }

  if (screen.menuLoading || screen.menuHydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading menu...</Text>
      </View>
    );
  }

  if (screen.categories.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <Text className="text-3xl">📋</Text>
        </View>
        <Text className="text-pos-xl font-semibold text-pos-text">No Categories Found</Text>
        <Text className="mt-2 text-center text-pos-base text-pos-text-muted">
          Menu data has not synced yet. Please wait or check your connection.
        </Text>
        <Text className="mt-4 text-pos-sm text-pos-text-faint">
          Categories: {screen.categories.length} | Items: {screen.menuItems.length}
        </Text>
      </View>
    );
  }

  return (
    <PerfProfiler id="OrderScreenContent">
      <View className="flex-1 bg-surface">
        <View className="flex-1 flex-row">
          <View className="w-[30%]">
            <PerfProfiler id="OrderPanel">
              <OrderPanel
                order={screen.order}
                items={screen.itemsForPanel}
                guestCount={screen.guestCount}
                onGuestCountChange={screen.handleGuestCountChange}
                onUpdateQuantity={screen.updateQuantity}
                onEditModifiers={screen.handleEditModifiers}
                onConfirmOrder={screen.handleConfirmOrder}
                onRemoveItem={screen.removeItem}
                onSendToKitchen={screen.handleSendToKitchen}
                onPayment={screen.handlePayment}
                onCancelOrder={screen.handleCancelOrder}
                pendingRoundItems={screen.pendingRoundItemsDisplay}
                currentRound={screen.currentRound}
                roundSentAt={screen.roundSentAt}
                onConfirmRound={screen.handleConfirmRound}
                onCancelRound={screen.handleCancelRound}
                onPrintBill={screen.handlePrintBill}
                isShiftOpen={screen.isShiftOpen}
                assignedCustomer={screen.assignedCustomer}
                onAssignCustomer={screen.handleAssignCustomer}
                onClearCustomer={screen.handleClearCustomer}
              />
            </PerfProfiler>
          </View>

          <View className="w-[70%] flex-1">
            <View className="border-b border-border bg-surface-card px-4 py-3">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-pos-lg font-bold text-pos-text">
                    {screen.table?.table_number || `Table ${tableId}`}
                  </Text>
                  {screen.order && (
                    <Text className="text-pos-xs text-pos-text-muted">
                      {screen.order.order_number}
                    </Text>
                  )}
                </View>
                <View className="w-[52%]">
                  <MenuSearchBar
                    value={screen.searchQuery}
                    onChangeText={screen.setSearchQuery}
                    className="mx-0 my-0"
                  />
                </View>
                <View className="flex-1" />
              </View>
            </View>

            <PerfProfiler id="CategoryTabs">
              <CategoryTabs
                categories={screen.topLevelCategories}
                subCategories={screen.subCategories}
                selectedCategoryId={screen.selectedCategoryId}
                selectedSubCategoryId={screen.selectedSubCategoryId}
                onSelectCategory={screen.handleSelectCategory}
                onSelectSubCategory={screen.handleSelectSubCategory}
              />
            </PerfProfiler>

            <PerfProfiler id="MenuGrid">
              <MenuGrid
                items={screen.menuItemsList}
                allItems={screen.allItemsForGrid}
                categoryById={screen.categoryById}
                quantitiesByMenuItemId={screen.quantitiesByMenuItemId}
                onItemPress={screen.handleMenuItemPress}
                onDecrementItem={screen.handleMenuItemDecrement}
                disabled={!screen.isShiftOpen}
              />
            </PerfProfiler>
          </View>
        </View>

        <KOTTicketPreview kot={screen.lastKOT} onDismiss={screen.dismissKOT} />
        <ReceiptPreview bill={screen.lastBill} onDismiss={screen.dismissBill} />

        {screen.selectedMenuItem && (
          <ModifierPicker
            visible={screen.showModifierPicker}
            menuItem={screen.selectedMenuItem}
            modifierGroups={screen.menuItemModifiers}
            initialSelectedModifiers={screen.isEditing ? screen.editingItemModifiers : undefined}
            initialNotes={screen.isEditing ? screen.editingItemNotes : undefined}
            initialWeight={screen.isEditing ? screen.editingItemWeight : undefined}
            submitLabel={screen.isEditing ? 'Update Item' : undefined}
            onConfirm={screen.handleModifierConfirm}
            onCancel={screen.handleModifierCancel}
          />
        )}
      </View>
    </PerfProfiler>
  );
}
