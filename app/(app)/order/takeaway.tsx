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

export default function TakeawayOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return <TakeawayOrderContent orderId={orderId} />;
}

function TakeawayOrderContent({ orderId }: { orderId?: string }) {
  useMountTimer('TakeawayOrderContent');

  const screen = useOrderScreen({
    orderType: 'takeaway',
    tableId: null,
    orderId: orderId ?? null,
  });

  if (screen.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading takeaway order...</Text>
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
    <PerfProfiler id="TakeawayOrderContent">
      <View className="flex-1 bg-surface">
        <View className="flex-1 flex-row">
          <View style={{ flex: 3 }}>
            <PerfProfiler id="OrderPanel">
              <OrderPanel
                order={screen.order}
                items={screen.itemsForPanel}
                guestCount={null}
                onGuestCountChange={() => {}}
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

          <View style={{ flex: 7 }}>
            <View className="border-b border-border bg-surface-card px-5 py-4">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-pos-2xl font-bold text-pos-text">🛍 Takeaway</Text>
                  {screen.order && (
                    <Text className="mt-1 text-pos-sm text-pos-text-muted">
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
