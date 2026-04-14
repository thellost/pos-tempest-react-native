import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { MoveTableModal } from '@/components/order/MoveTableModal';
import { OrderScreenPhone } from '@/components/order/OrderScreenPhone';
import { OrderScreenTablet } from '@/components/order/OrderScreenTablet';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import { ORDER_TYPE } from '@/constants/enums';
import { useAuth } from '@/hooks/use-auth';
import { useLayout } from '@/hooks/use-layout';
import { useOrderScreen } from '@/hooks/use-order-screen';
import { PerfProfiler, useMountTimer } from '@/utils/perf-debug';
import { toInt } from '@/utils/coerce';

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

  const { isPhone } = useLayout();
  const { user } = useAuth();

  const screen = useOrderScreen({
    orderType: 'dine-in',
    tableId: toInt(tableId),
    orderId: orderId ?? null,
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

  const title = screen.table?.table_number || `Table ${tableId}`;

  const sharedProps = {
    title,
    order: screen.order,
    itemsForPanel: screen.itemsForPanel,
    pendingRoundItemsDisplay: screen.pendingRoundItemsDisplay,
    guestCount: screen.guestCount,
    currentRound: screen.currentRound,
    roundSentAt: screen.roundSentAt,
    onGuestCountChange: screen.handleGuestCountChange,
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
    onMoveTable: screen.handleMoveTable,
    isShiftOpen: screen.isShiftOpen,
    assignedCustomer: screen.assignedCustomer,
    onAssignCustomer: screen.handleAssignCustomer,
    onClearCustomer: screen.handleClearCustomer,
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
    <PerfProfiler id="OrderScreenContent">
      <View className="flex-1 bg-surface">
        {isPhone ? (
          <OrderScreenPhone {...sharedProps} />
        ) : (
          <OrderScreenTablet {...sharedProps} />
        )}

        <KOTTicketPreview kot={screen.lastKOT} onDismiss={screen.dismissKOT} />
        <ReceiptPreview bill={screen.lastBill} onDismiss={screen.dismissBill} />

        {screen.order && screen.order.order_type === ORDER_TYPE.DINE_IN && (
          <MoveTableModal
            visible={screen.showMoveTableModal}
            onClose={() => screen.setShowMoveTableModal(false)}
            orderId={screen.order.id}
            currentTableId={toInt(tableId)}
            branchId={user?.branch_id ? toInt(user.branch_id) : 0}
            onMoved={screen.handleMoveTableComplete}
          />
        )}

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
