import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { MenuSearchBar } from '@/components/menu/MenuSearchBar';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { type AssignedCustomer } from '@/components/order/CustomerPickerRow';
import { OrderPanel } from '@/components/order/OrderPanel';
import type { OrderItemDisplay } from '@/components/order/types';
import { cartItemToDisplay } from '@/components/order/types';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import { useMenu, type MenuItemWithInventory } from '@/hooks/use-menu';
import { useModifierPicker } from '@/hooks/use-modifier-picker';
import { useOrder } from '@/hooks/use-order';
import { useAuth } from '@/hooks/use-auth';
import { useShift } from '@/hooks/use-shift';
import { assignCustomerToOrder, confirmOrder as confirmOrderService } from '@/services/order.service';
import { PerfProfiler, logPerf, nowMs, useMountTimer } from '@/utils/perf-debug';
import { toInt, toIntOrNull } from '@/utils/coerce';

export default function TakeawayOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return <TakeawayOrderContent orderId={orderId} />;
}

interface TakeawayOrderContentProps {
  orderId?: string;
}

function TakeawayOrderContent({ orderId }: TakeawayOrderContentProps) {
  useMountTimer('TakeawayOrderContent');
  const screenBootRef = useRef(nowMs());

  const orderIdNum = orderId ? parseInt(orderId, 10) : null;

  const { user } = useAuth();
  const { isShiftOpen, activeShift } = useShift();

  const {
    topLevelCategories,
    getSubCategories,
    getMenuItemsByCategory,
    getCategoryById,
    getModifierGroupsForMenuItem,
    isLoading: menuLoading,
    isHydrating: menuHydrating,
    categories,
    menuItems,
  } = useMenu();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedCustomer, setAssignedCustomer] = useState<AssignedCustomer | null>(null);

  const hasBootLoggedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order hook — manages all order state and lifecycle
  const {
    order,
    orderItems,
    cartItems,
    pendingRoundItems,
    isLoading: orderLoading,
    currentRound,
    roundSentAt,
    addItemToOrder: addItemToOrderHandler,
    updateQuantity,
    removeItem,
    updateNotes,
    editModifiers,
    confirmOrder: confirmOrderHook,
    cancelOrder,
    confirmRound: handleConfirmRound,
    cancelRound: handleCancelRound,
    sendToKitchen,
    lastKOT,
    dismissKOT,
    printBill,
    lastBill,
    dismissBill,
    goToPayment,
    updateCartItem,
    reload,
    setOrder,
    setOrderItems,
  } = useOrder({
    tableId: null,
    orderId: orderIdNum,
    orderType: 'takeaway',
    menuItems,
    isShiftOpen,
    shiftId: activeShift ? toInt(activeShift.id) : null,
  });

  // Modifier picker state + handlers
  const {
    showModifierPicker,
    selectedMenuItem,
    menuItemModifiers,
    editingItemModifiers,
    editingItemNotes,
    editingItemWeight,
    isEditing,
    handleMenuItemPress,
    handleModifierConfirm,
    handleEditModifiers,
    handleCancel: handleModifierCancel,
  } = useModifierPicker({
    cartItems,
    orderItems,
    menuItems,
    getModifierGroupsForMenuItem,
    addItemToOrder: addItemToOrderHandler,
    updateCartItem,
    editModifiers,
    logTag: 'TakeawayOrder',
  });

  const isLoading = orderLoading;

  // Load assigned customer when order changes
  useEffect(() => {
    let cancelled = false;
    const customerId = order?.customer_id;
    if (!customerId) {
      setAssignedCustomer(null);
      return;
    }
    import('@/db/provider').then(({ powersync }) =>
      powersync
        .getOptional<{ id: number; name: string; phone: string | null; loyalty_points: number }>(
          `SELECT id, name, phone, loyalty_points FROM customers WHERE id = ? LIMIT 1`,
          [customerId]
        )
        .then((c) => {
          if (!cancelled && c) {
            setAssignedCustomer({
              id: toInt(c.id),
              name: c.name,
              phone: c.phone,
              loyalty_points: c.loyalty_points,
            });
          }
        })
        .catch(() => {})
    );
    return () => { cancelled = true; };
  }, [order?.customer_id]);

  const handleAssignCustomer = useCallback(async (customer: AssignedCustomer) => {
    const orderId = order ? toInt(order.id) : null;
    if (orderId) {
      try {
        await assignCustomerToOrder(orderId, customer.id);
      } catch (err) {
        console.error('[TakeawayOrder] assignCustomerToOrder error:', err);
      }
    }
    setAssignedCustomer(customer);
  }, [order]);

  const handleClearCustomer = useCallback(async () => {
    const orderId = order ? toInt(order.id) : null;
    if (orderId) {
      try {
        await assignCustomerToOrder(orderId, null);
      } catch (err) {
        console.error('[TakeawayOrder] clearCustomer error:', err);
      }
    }
    setAssignedCustomer(null);
  }, [order]);

  const subCategories = selectedCategoryId ? getSubCategories(selectedCategoryId) : [];

  // Log boot time once data is ready
  useEffect(() => {
    if (!isLoading && !menuLoading && !menuHydrating && !hasBootLoggedRef.current) {
      hasBootLoggedRef.current = true;
      logPerf('TakeawayOrder:bootToDataReady', nowMs() - screenBootRef.current);
    }
  }, [isLoading, menuLoading, menuHydrating]);

  useEffect(() => {
    if (topLevelCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(toInt(topLevelCategories[0].id));
    }
  }, [topLevelCategories, selectedCategoryId]);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId(null);
  }, []);

  const handleSelectSubCategory = useCallback((subCategoryId: number | null) => {
    setSelectedSubCategoryId(subCategoryId);
  }, []);

  const handleSendToKitchen = useCallback(async (round: number) => {
    await sendToKitchen(round);
  }, [sendToKitchen]);

  const handlePayment = useCallback(() => {
    if (!order) {
      Alert.alert('Payment', 'No active order found. Please add items first.');
      return;
    }
    goToPayment();
  }, [order, goToPayment]);

  const handleCancelOrder = useCallback(() => {
    if (!order) {
      Alert.alert('Cancel Order', 'No active order found.');
      return;
    }

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This will mark the order as cancelled and keep it in history.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await cancelOrder('Cancelled from takeaway order panel');
                Alert.alert('Order Cancelled', 'Order has been marked as cancelled.');
              } catch (error) {
                console.error('[TakeawayOrder] Error cancelling order:', error);
                Alert.alert('Error', 'Failed to cancel order.');
              }
            })();
          },
        },
      ]
    );
  }, [order, cancelOrder]);

  const handlePrintBill = useCallback(async () => {
    await printBill();
  }, [printBill]);

  // Confirm order — handles both re-confirming an existing draft order (loaded from DB)
  // and creating a new order from local cart items.
  const handleConfirmOrder = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (order) {
        // Existing draft order loaded from DB — confirm it directly
        if (!user) throw new Error('Cashier id is not provided');
        await confirmOrderService(toInt(order.id), toInt(user.id));
        await reload();
      } else {
        // New order from local cart — delegate to hook (creates order, adds items, confirms)
        await confirmOrderHook();
      }
      Alert.alert('Pesanan Dikonfirmasi', 'Pesanan berhasil dibuat.');
    } catch (error) {
      console.error('[TakeawayOrder] Error confirming order:', error);
      Alert.alert('Error', 'Gagal mengkonfirmasi pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, order, user, confirmOrderHook, reload]);

  const handleMenuItemDecrement = useCallback(async (item: MenuItemWithInventory) => {
    const menuItemId = toInt(item.id);

    if (order) {
      const matchingItems = orderItems.filter((orderItem) => {
        return toInt(orderItem.menu_item_id) === menuItemId && !orderItem.is_voided;
      });

      if (matchingItems.length === 0) return;

      const targetOrderItem = matchingItems
        .slice()
        .sort((left, right) => toInt(right.id) - toInt(left.id))[0];

      await updateQuantity(toInt(targetOrderItem.id), toInt(targetOrderItem.quantity) - 1);
    } else {
      const matchingItems = cartItems.filter(cartItem => cartItem.menu_item_id === menuItemId);
      if (matchingItems.length === 0) return;

      const targetItem = matchingItems[matchingItems.length - 1];
      await updateQuantity(targetItem.id, targetItem.quantity - 1);
    }
  }, [order, orderItems, cartItems, updateQuantity]);

  const quantitiesByMenuItemId = useMemo<Record<number, number>>(() => {
    const start = nowMs();
    const result: Record<number, number> = {};

    if (order) {
      orderItems.forEach((orderItem) => {
        if (orderItem.is_voided) return;
        const menuItemId = toInt(orderItem.menu_item_id);
        const quantity = toInt(orderItem.quantity);
        result[menuItemId] = (result[menuItemId] || 0) + quantity;
      });
    } else {
      cartItems.forEach((cartItem) => {
        result[cartItem.menu_item_id] = (result[cartItem.menu_item_id] || 0) + cartItem.quantity;
      });
    }

    logPerf('useMemo:quantitiesByMenuItemId', nowMs() - start, { itemCount: order ? orderItems.length : cartItems.length });
    return result;
  }, [order, orderItems, cartItems]);

  const currentCategory = selectedCategoryId ? getCategoryById(selectedCategoryId) : undefined;
  const currentSubCategory = selectedSubCategoryId ? subCategories.find(c => toInt(c.id) === selectedSubCategoryId) : undefined;

  const allMenuItems = useMemo(() => {
    const start = nowMs();
    const result = selectedCategoryId ? getMenuItemsByCategory(selectedCategoryId) : [];
    logPerf('useMemo:allMenuItems', nowMs() - start, { categoryId: selectedCategoryId, count: result.length });
    return result;
  }, [selectedCategoryId, getMenuItemsByCategory]);

  // All items across every category — passed to MenuGrid to mount once
  const allItemsForGrid = useMemo(
    () => (categories.length > 0 ? menuItems : []),
    [categories, menuItems],
  );

  // Category colour + name lookup for per-item card display
  const categoryById = useMemo(() => {
    const map = new Map<number, { name: string; button_color?: string | null }>();
    categories.forEach((cat) => {
      map.set(toInt(cat.id), { name: cat.name, button_color: cat.button_color });
    });
    return map;
  }, [categories]);

  const menuItemsList = useMemo(() => {
    const start = nowMs();
    let result: MenuItemWithInventory[];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = menuItems.filter((item: MenuItemWithInventory) =>
        item.name.toLowerCase().includes(query)
      );
    } else if (!selectedSubCategoryId) {
      result = allMenuItems;
    } else {
      result = allMenuItems.filter((item: MenuItemWithInventory) =>
        toIntOrNull(item.category_id) === selectedSubCategoryId
      );
    }
    logPerf('useMemo:menuItemsList', nowMs() - start, { subCategoryId: selectedSubCategoryId, count: result.length });
    return result;
  }, [searchQuery, menuItems, allMenuItems, selectedSubCategoryId]);

  const menuCategoryByItemId = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    menuItems.forEach((item) => {
      const itemId = toInt(item.id);
      const categoryId = toIntOrNull(item.category_id);
      if (categoryId === null) return;
      const category = categories.find((cat) => toInt(cat.id) === categoryId);
      if (category) {
        map.set(itemId, { id: toInt(category.id), name: category.name });
      }
    });
    return map;
  }, [menuItems, categories]);

  const topLevelCategoryById = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    categories.forEach((category) => {
      const catId = toInt(category.id);
      const parentId = toIntOrNull(category.parent_id);
      if (parentId === null) {
        map.set(catId, { id: catId, name: category.name });
      }
    });
    return map;
  }, [categories]);

  const topLevelBySubCategoryId = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    categories.forEach((category) => {
      const catId = toInt(category.id);
      const parentId = toIntOrNull(category.parent_id);
      if (parentId !== null) {
        const parent = topLevelCategoryById.get(parentId);
        if (parent) {
          map.set(catId, parent);
        }
      }
    });
    return map;
  }, [categories, topLevelCategoryById]);

  const itemsForPanel = useMemo<OrderItemDisplay[]>(() => {
    if (order) {
      return orderItems.map((item) => {
        const itemId = toInt(item.menu_item_id);
        const category = menuCategoryByItemId.get(itemId);
        let groupName = category?.name ?? 'Other';

        if (category) {
          const parentName = topLevelBySubCategoryId.get(category.id)?.name;
          const isTopLevel = topLevelCategoryById.has(category.id);
          if (!isTopLevel && parentName) {
            groupName = parentName;
          }
        }

        const numericId = toInt(item.id);
        return {
          ...item,
          id: Number.isFinite(numericId) ? numericId : item.id,
          category_group: groupName,
        } as OrderItemDisplay;
      });
    } else {
      return cartItems.map((item) => {
        const category = menuCategoryByItemId.get(item.menu_item_id);
        let groupName = category?.name ?? 'Other';

        if (category) {
          const parentName = topLevelBySubCategoryId.get(category.id)?.name;
          const isTopLevel = topLevelCategoryById.has(category.id);
          if (!isTopLevel && parentName) {
            groupName = parentName;
          }
        }

        return cartItemToDisplay(item, groupName);
      });
    }
  }, [order, orderItems, cartItems, menuCategoryByItemId, topLevelBySubCategoryId, topLevelCategoryById]);

  // Convert pending round items to display format
  const pendingRoundItemsDisplay = useMemo<OrderItemDisplay[]>(() => {
    return pendingRoundItems.map((item) => {
      const category = menuCategoryByItemId.get(item.menu_item_id);
      let groupName = category?.name ?? 'Other';

      if (category) {
        const parentName = topLevelBySubCategoryId.get(category.id)?.name;
        const isTopLevel = topLevelCategoryById.has(category.id);
        if (!isTopLevel && parentName) {
          groupName = parentName;
        }
      }

      return cartItemToDisplay(item, groupName);
    });
  }, [pendingRoundItems, menuCategoryByItemId, topLevelBySubCategoryId, topLevelCategoryById]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading takeaway order...</Text>
      </View>
    );
  }

  if (menuLoading || menuHydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading menu...</Text>
      </View>
    );
  }

  if (categories.length === 0) {
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
          Categories: {categories.length} | Items: {menuItems.length}
        </Text>
      </View>
    );
  }

  return (
    <PerfProfiler id="TakeawayOrderContent">
      <View className="flex-1 bg-surface">
      <View className="flex-1 flex-row">
        <View className="w-[30%]">
          <PerfProfiler id="OrderPanel">
            <OrderPanel
              order={order}
              items={itemsForPanel}
              guestCount={null}
              onGuestCountChange={() => {}}
              onUpdateQuantity={updateQuantity}
              onEditModifiers={handleEditModifiers}
              onConfirmOrder={handleConfirmOrder}
              onRemoveItem={removeItem}
              onSendToKitchen={handleSendToKitchen}
              onPayment={handlePayment}
              onCancelOrder={handleCancelOrder}
              pendingRoundItems={pendingRoundItemsDisplay}
              currentRound={currentRound}
              roundSentAt={roundSentAt}
              onConfirmRound={handleConfirmRound}
              onCancelRound={handleCancelRound}
              onPrintBill={handlePrintBill}
              isShiftOpen={isShiftOpen}
              assignedCustomer={assignedCustomer}
              onAssignCustomer={handleAssignCustomer}
              onClearCustomer={handleClearCustomer}
            />
          </PerfProfiler>
        </View>

        <View className="w-[70%] flex-1">
          <View className="border-b border-border bg-surface-card px-5 py-4">
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-pos-2xl font-bold text-pos-text">
                  🛍 Takeaway
                </Text>
                {order && (
                  <Text className="mt-1 text-pos-sm text-pos-text-muted">
                    {order.order_number}
                  </Text>
                )}
              </View>

              <View className="w-[52%]">
                <MenuSearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
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
              onSelectCategory={handleSelectCategory}
              onSelectSubCategory={handleSelectSubCategory}
            />
          </PerfProfiler>

          <PerfProfiler id="MenuGrid">
            <MenuGrid
              items={menuItemsList}
              allItems={allItemsForGrid}
              categoryById={categoryById}
              quantitiesByMenuItemId={quantitiesByMenuItemId}
              onItemPress={handleMenuItemPress}
              onDecrementItem={handleMenuItemDecrement}
              disabled={!isShiftOpen}
            />
          </PerfProfiler>
        </View>
      </View>

      <KOTTicketPreview kot={lastKOT} onDismiss={dismissKOT} />
      <ReceiptPreview bill={lastBill} onDismiss={dismissBill} />

      {selectedMenuItem && (
        <ModifierPicker
          visible={showModifierPicker}
          menuItem={selectedMenuItem}
          modifierGroups={menuItemModifiers}
          initialSelectedModifiers={isEditing ? editingItemModifiers : undefined}
          initialNotes={isEditing ? editingItemNotes : undefined}
          initialWeight={isEditing ? editingItemWeight : undefined}
          submitLabel={isEditing ? 'Update Item' : undefined}
          onConfirm={handleModifierConfirm}
          onCancel={handleModifierCancel}
        />
      )}
      </View>
    </PerfProfiler>
  );
}
