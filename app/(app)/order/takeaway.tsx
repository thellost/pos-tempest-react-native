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
import { PRICING_TYPE } from '@/constants/enums';
import { useMenu, type MenuItemWithInventory, type ModifierGroupWithModifiers } from '@/hooks/use-menu';
import { useOrder } from '@/hooks/use-order';
import { useShift } from '@/hooks/use-shift';
import type { SelectedModifier } from '@/services/order.service';
import { assignCustomerToOrder, confirmOrder as confirmOrderService } from '@/services/order.service';
import { PerfProfiler, logPerf, nowMs, useMountTimer } from '@/utils/perf-debug';

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

  // Modifier picker UI state
  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemWithInventory | null>(null);
  const [menuItemModifiers, setMenuItemModifiers] = useState<ModifierGroupWithModifiers[]>([]);
  const [editingOrderItemId, setEditingOrderItemId] = useState<number | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editingItemNotes, setEditingItemNotes] = useState<string>('');
  const [editingItemModifiers, setEditingItemModifiers] = useState<SelectedModifier[]>([]);
  const [editingItemWeight, setEditingItemWeight] = useState<string>('');

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
    shiftId: activeShift ? (typeof activeShift.id === 'string' ? parseInt(activeShift.id, 10) : activeShift.id) : null,
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
              id: typeof c.id === 'string' ? parseInt(c.id as string, 10) : c.id,
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
    const orderId = order ? (typeof order.id === 'string' ? parseInt(order.id as string, 10) : order.id) : null;
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
    const orderId = order ? (typeof order.id === 'string' ? parseInt(order.id as string, 10) : order.id) : null;
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
      const firstCategoryId = typeof topLevelCategories[0].id === 'string'
        ? parseInt(topLevelCategories[0].id, 10)
        : topLevelCategories[0].id;
      setSelectedCategoryId(firstCategoryId);
    }
  }, [topLevelCategories, selectedCategoryId]);

  const handleMenuItemPress = useCallback(async (item: MenuItemWithInventory) => {
    try {
      const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
      const modifiers = await getModifierGroupsForMenuItem(itemId);
      const isWeightBased = item.pricing_type === 'weight_based';

      if (modifiers.length > 0 || isWeightBased) {
        setSelectedMenuItem(item);
        setMenuItemModifiers(modifiers);
        setShowModifierPicker(true);
      } else {
        await addItemToOrderHandler(item, [], null, '');
      }
    } catch (error) {
      console.error('[TakeawayOrder] Error handling menu item press:', error);
    }
  }, [getModifierGroupsForMenuItem, addItemToOrderHandler]);

  const handleModifierConfirm = useCallback(async (
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => {
    if (!selectedMenuItem) return;

    if (editingCartItemId) {
      const modifierTotal = modifiers.reduce((sum, m) => sum + (Number(m.extra_price) || 0), 0);
      const weightedUnitPrice = weight ? selectedMenuItem.price * weight : selectedMenuItem.price;
      const currentCartItem = cartItems.find(i => i.id === editingCartItemId);
      const quantity = currentCartItem?.quantity ?? 1;
      updateCartItem(editingCartItemId, {
        modifiers,
        notes: notes || null,
        weight,
        unit_price: weightedUnitPrice,
        modifier_total: modifierTotal,
        total: (weightedUnitPrice + modifierTotal) * quantity,
      });
      setEditingCartItemId(null);
      setEditingItemNotes('');
      setEditingItemModifiers([]);
      setEditingItemWeight('');
    } else if (editingOrderItemId) {
      const unitPrice = selectedMenuItem.pricing_type === PRICING_TYPE.WEIGHT_BASED && weight && weight > 0
        ? selectedMenuItem.price * weight
        : undefined;
      await editModifiers(editingOrderItemId, modifiers, weight, notes, unitPrice);
      setEditingOrderItemId(null);
      setEditingItemNotes('');
      setEditingItemModifiers([]);
      setEditingItemWeight('');
    } else {
      await addItemToOrderHandler(selectedMenuItem, modifiers, weight, notes);
    }
    setShowModifierPicker(false);
    setSelectedMenuItem(null);
    setMenuItemModifiers([]);
  }, [selectedMenuItem, editingCartItemId, editingOrderItemId, updateCartItem, editModifiers, addItemToOrderHandler]);

  const handleEditModifiers = useCallback(async (itemId: number | string) => {
    if (typeof itemId === 'string') {
      const cartItem = cartItems.find(item => item.id === itemId);
      if (!cartItem) return;

      const menuItem = menuItems.find(m => {
        const mId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
        return mId === cartItem.menu_item_id;
      });
      if (!menuItem) return;

      const modifiers = await getModifierGroupsForMenuItem(cartItem.menu_item_id);
      setSelectedMenuItem(menuItem);
      setMenuItemModifiers(modifiers);
      setEditingCartItemId(itemId);
      setEditingItemModifiers(cartItem.modifiers);
      setEditingItemNotes(cartItem.notes ?? '');
      setEditingItemWeight(cartItem.weight ? cartItem.weight.toString() : '');
      setShowModifierPicker(true);
    } else {
      const targetItem = orderItems.find((item) => {
        const currentId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
        return currentId === itemId;
      });

      if (!targetItem) return;

      const menuItemId = typeof targetItem.menu_item_id === 'string'
        ? parseInt(targetItem.menu_item_id as string, 10)
        : targetItem.menu_item_id;
      const menuItem = menuItems.find((item) => {
        const currentId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
        return currentId === menuItemId;
      });

      if (!menuItem) return;

      const modifiers = await getModifierGroupsForMenuItem(menuItemId);
      const selectedModifiers = targetItem.modifiers.map((modifier) => {
        const modifierId = typeof modifier.modifier_id === 'string'
          ? parseInt(modifier.modifier_id as string, 10)
          : modifier.modifier_id;
        return {
          modifier_id: modifierId,
          modifier_name: modifier.modifier_name,
          modifier_group_name: modifier.modifier_group_name,
          extra_price: modifier.extra_price,
        };
      });
      setSelectedMenuItem(menuItem);
      setMenuItemModifiers(modifiers);
      setEditingOrderItemId(itemId);
      setEditingItemNotes(targetItem.notes ?? '');
      setEditingItemModifiers(selectedModifiers);
      if (menuItem.pricing_type === PRICING_TYPE.WEIGHT_BASED && menuItem.price > 0) {
        setEditingItemWeight((targetItem.unit_price / menuItem.price).toString());
      } else {
        setEditingItemWeight('');
      }
      setShowModifierPicker(true);
    }
  }, [getModifierGroupsForMenuItem, menuItems, orderItems, cartItems]);

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
        const currentOrderId = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
        await confirmOrderService(currentOrderId);
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
  }, [isSubmitting, order, confirmOrderHook, reload]);

  const handleMenuItemDecrement = useCallback(async (item: MenuItemWithInventory) => {
    const menuItemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;

    if (order) {
      const matchingItems = orderItems.filter((orderItem) => {
        const orderMenuItemId = typeof orderItem.menu_item_id === 'string'
          ? parseInt(orderItem.menu_item_id as string, 10)
          : orderItem.menu_item_id;
        return orderMenuItemId === menuItemId && !orderItem.is_voided;
      });

      if (matchingItems.length === 0) return;

      const targetOrderItem = matchingItems
        .slice()
        .sort((left, right) => {
          const leftId = typeof left.id === 'string' ? parseInt(left.id as string, 10) : left.id;
          const rightId = typeof right.id === 'string' ? parseInt(right.id as string, 10) : right.id;
          return rightId - leftId;
        })[0];

      const targetItemId = typeof targetOrderItem.id === 'string'
        ? parseInt(targetOrderItem.id as string, 10)
        : targetOrderItem.id;
      const currentQuantity = typeof targetOrderItem.quantity === 'string'
        ? parseInt(targetOrderItem.quantity as string, 10)
        : targetOrderItem.quantity;

      await updateQuantity(targetItemId, currentQuantity - 1);
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
        const menuItemId = typeof orderItem.menu_item_id === 'string'
          ? parseInt(orderItem.menu_item_id as string, 10)
          : orderItem.menu_item_id;
        const quantity = typeof orderItem.quantity === 'string'
          ? parseInt(orderItem.quantity as string, 10)
          : orderItem.quantity;
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
  const currentSubCategory = selectedSubCategoryId ? subCategories.find(c => {
    const catId = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
    return catId === selectedSubCategoryId;
  }) : undefined;

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
      const catId = typeof cat.id === 'string' ? parseInt(cat.id, 10) : cat.id;
      map.set(catId, { name: cat.name, button_color: cat.button_color });
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
      result = allMenuItems.filter((item: MenuItemWithInventory) => {
        const itemCategoryId = typeof item.category_id === 'string'
          ? parseInt(item.category_id as string, 10)
          : item.category_id;
        return itemCategoryId === selectedSubCategoryId;
      });
    }
    logPerf('useMemo:menuItemsList', nowMs() - start, { subCategoryId: selectedSubCategoryId, count: result.length });
    return result;
  }, [searchQuery, menuItems, allMenuItems, selectedSubCategoryId]);

  const menuCategoryByItemId = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    menuItems.forEach((item) => {
      const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
      const categoryId = typeof item.category_id === 'string'
        ? parseInt(item.category_id as string, 10)
        : item.category_id;
      const category = categories.find((cat) => {
        const catId = typeof cat.id === 'string' ? parseInt(cat.id, 10) : cat.id;
        return catId === categoryId;
      });
      if (category) {
        map.set(itemId, {
          id: typeof category.id === 'string' ? parseInt(category.id, 10) : category.id,
          name: category.name,
        });
      }
    });
    return map;
  }, [menuItems, categories]);

  const topLevelCategoryById = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    categories.forEach((category) => {
      const catId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
      const parentId = category.parent_id === null
        ? null
        : typeof category.parent_id === 'string'
          ? parseInt(category.parent_id as string, 10)
          : category.parent_id;
      if (parentId === null) {
        map.set(catId, { id: catId, name: category.name });
      }
    });
    return map;
  }, [categories]);

  const topLevelBySubCategoryId = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    categories.forEach((category) => {
      const catId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
      const parentId = category.parent_id === null
        ? null
        : typeof category.parent_id === 'string'
          ? parseInt(category.parent_id as string, 10)
          : category.parent_id;
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
        const itemId = typeof item.menu_item_id === 'string'
          ? parseInt(item.menu_item_id as string, 10)
          : item.menu_item_id;
        const category = menuCategoryByItemId.get(itemId);
        let groupName = category?.name ?? 'Other';

        if (category) {
          const parentName = topLevelBySubCategoryId.get(category.id)?.name;
          const isTopLevel = topLevelCategoryById.has(category.id);
          if (!isTopLevel && parentName) {
            groupName = parentName;
          }
        }

        const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
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
          initialSelectedModifiers={editingOrderItemId || editingCartItemId ? editingItemModifiers : undefined}
          initialNotes={editingOrderItemId || editingCartItemId ? editingItemNotes : undefined}
          initialWeight={editingOrderItemId || editingCartItemId ? editingItemWeight : undefined}
          submitLabel={editingOrderItemId || editingCartItemId ? 'Update Item' : undefined}
          onConfirm={handleModifierConfirm}
          onCancel={() => {
            setShowModifierPicker(false);
            setSelectedMenuItem(null);
            setMenuItemModifiers([]);
            setEditingOrderItemId(null);
            setEditingCartItemId(null);
            setEditingItemNotes('');
            setEditingItemModifiers([]);
            setEditingItemWeight('');
          }}
        />
      )}
      </View>
    </PerfProfiler>
  );
}
