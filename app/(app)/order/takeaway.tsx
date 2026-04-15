import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderScreenPhone } from '@/components/order/OrderScreenPhone';
import { OrderScreenTablet } from '@/components/order/OrderScreenTablet';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import { useLayout } from '@/hooks/use-layout';
import { useOrderScreen } from '@/hooks/use-order-screen';
import { PerfProfiler, useMountTimer } from '@/utils/perf-debug';

export default function TakeawayOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return <TakeawayOrderContent orderId={orderId} />;
}

function TakeawayOrderContent({ orderId }: { orderId?: string }) {
  useMountTimer('TakeawayOrderContent');

  const { isPhone } = useLayout();

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

  const sharedProps = {
    title: '🛍 Takeaway',
    order: screen.order,
    itemsForPanel: screen.itemsForPanel,
    pendingRoundItemsDisplay: screen.pendingRoundItemsDisplay,
    guestCount: null,
    currentRound: screen.currentRound,
    roundSentAt: screen.roundSentAt,
    onGuestCountChange: () => {},
    onUpdateQuantity: screen.updateQuantity,
    onEditModifiers: screen.handleEditModifiers,
    onConfirmOrder: screen.handleConfirmOrder,
    onRemoveItem: screen.removeItem,
    onSendToKitchen: screen.handleSendToKitchen,
    onPayment: screen.handlePayment,
    onCancelOrder: screen.handleCancelOrder,
    onConfirmRound: screen.handleConfirmRound,
    onCancelRound: screen.handleCancelRound,
    onPrintBill: screen.handlePrintBill,
    isShiftOpen: screen.isShiftOpen,
    assignedCustomer: screen.assignedCustomer,
    onAssignCustomer: screen.handleAssignCustomer,
    onClearCustomer: screen.handleClearCustomer,
    guestName: screen.guestName,
    onSetGuestName: screen.handleSetGuestName,
    onClearGuestName: screen.handleClearGuestName,
    topLevelCategories: screen.topLevelCategories,
    subCategories: screen.subCategories,
    selectedCategoryId: screen.selectedCategoryId,
    selectedSubCategoryId: screen.selectedSubCategoryId,
    onSelectCategory: screen.handleSelectCategory,
    onSelectSubCategory: screen.handleSelectSubCategory,
    searchQuery: screen.searchQuery,
    onSearchQueryChange: screen.setSearchQuery,
    menuItemsList: screen.menuItemsList,
    allItemsForGrid: screen.allItemsForGrid,
    categoryById: screen.categoryById,
    quantitiesByMenuItemId: screen.quantitiesByMenuItemId,
    onMenuItemPress: screen.handleMenuItemPress,
    onMenuItemDecrement: screen.handleMenuItemDecrement,
  };

  return (
    <PerfProfiler id="TakeawayOrderContent">
      <View className="flex-1 bg-surface">
        {isPhone ? (
          <OrderScreenPhone {...sharedProps} />
        ) : (
          <OrderScreenTablet {...sharedProps} />
        )}

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
