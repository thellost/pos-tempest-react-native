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
import { ORDER_STATUS } from '@/constants/enums';
import { powersync } from '@/db/provider';
import { useMenu, type MenuItemWithInventory } from '@/hooks/use-menu';
import { useModifierPicker } from '@/hooks/use-modifier-picker';
import { useOrder } from '@/hooks/use-order';
import { useShift } from '@/hooks/use-shift';
import { assignCustomerToOrder } from '@/services/order.service';
import { PerfProfiler, logPerf, nowMs, timedAsync, useMountTimer } from '@/utils/perf-debug';
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

interface OrderScreenContentProps {
  tableId: string;
  orderId?: string;
}

interface OrderTableData {
  id: number | string;
  table_number: string;
  floor_area_name: string;
  active_order_id: number | null;
  active_order_number: string | null;
  guest_count: number | null;
  order_total: number | null;
  order_created_at: string | null;
  order_status: string | null;
}

async function getOrderTableById(tableId: number): Promise<OrderTableData | null> {
  try {
    const result = await powersync.getOptional<OrderTableData>(
      `SELECT
        t.*,
        fa.name as floor_area_name,
        o.id as active_order_id,
        o.order_number as active_order_number,
        o.guest_count,
        o.total as order_total,
        o.created_at as order_created_at,
        o.status as order_status
      FROM tables t
      LEFT JOIN floor_areas fa ON t.floor_area_id = fa.id
      LEFT JOIN orders o ON t.id = o.table_id
        AND o.status NOT IN (?, ?, ?)
      WHERE t.id = ?`,
      [
        ORDER_STATUS.COMPLETED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.SERVED,
        tableId,
      ]
    );

    return result || null;
  } catch (error) {
    console.error('[OrderScreen] Error fetching table by ID:', error);
    return null;
  }
}

function OrderScreenContent({ tableId, orderId }: OrderScreenContentProps) {
  useMountTimer('OrderScreenContent');
  const screenBootRef = useRef(nowMs());

  const tableIdNum = parseInt(tableId, 10);
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

  const [table, setTable] = useState<any>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedCustomer, setAssignedCustomer] = useState<AssignedCustomer | null>(null);

  const hasLoadedTableIdRef = useRef<number | null>(null);

  // Order hook — manages all order state and lifecycle
  const {
    order,
    orderItems,
    cartItems,
    pendingRoundItems,
    isLoading: orderLoading,
    currentRound,
    roundSentAt,
    guestCount,
    addItemToOrder: addItemToOrderHandler,
    updateQuantity,
    removeItem,
    updateNotes,
    editModifiers,
    confirmOrder: handleConfirmOrder,
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
    setGuestCount,
    updateCartItem,
    reload,
    setOrder,
    setOrderItems,
  } = useOrder({
    tableId: tableIdNum,
    orderId: orderIdNum,
    orderType: 'dine-in',
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
    logTag: 'OrderScreen',
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
      .catch(() => {});
    return () => { cancelled = true; };
  }, [order?.customer_id]);

  const handleAssignCustomer = useCallback(async (customer: AssignedCustomer) => {
    const orderId = order ? toInt(order.id) : null;
    if (orderId) {
      try {
        await assignCustomerToOrder(orderId, customer.id);
      } catch (err) {
        console.error('[OrderScreen] assignCustomerToOrder error:', err);
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
        console.error('[OrderScreen] clearCustomer error:', err);
      }
    }
    setAssignedCustomer(null);
  }, [order]);

  const subCategories = selectedCategoryId ? getSubCategories(selectedCategoryId) : [];

  // Load table data on mount
  useEffect(() => {
    if (hasLoadedTableIdRef.current === tableIdNum) return;

    const loadData = async () => {
      const loadStart = nowMs();
      try {
        const tableData = await timedAsync(
          'query:getTableById',
          () => getOrderTableById(tableIdNum),
          { tableId: tableIdNum }
        );
        setTable(tableData);
        hasLoadedTableIdRef.current = tableIdNum;
      } catch (error) {
        console.error('[OrderScreen] Error loading table data:', error);
      } finally {
        logPerf('loadData:total', nowMs() - loadStart);
        logPerf('OrderScreen:bootToDataReady', nowMs() - screenBootRef.current);
      }
    };

    loadData();
  }, [tableIdNum]);

  useEffect(() => {
    if (topLevelCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(toInt(topLevelCategories[0].id));
    }
  }, [topLevelCategories, selectedCategoryId]);

  const handleGuestCountChange = useCallback((count: number) => {
    setGuestCount(count);
  }, [setGuestCount]);

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
                await cancelOrder('Cancelled from dine-in order panel');
                Alert.alert('Order Cancelled', 'Order has been marked as cancelled.');
              } catch (error) {
                console.error('[OrderScreen] Error cancelling order:', error);
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
      pendingRoundItems.forEach((pendingItem) => {
        result[pendingItem.menu_item_id] = (result[pendingItem.menu_item_id] || 0) + pendingItem.quantity;
      });
    } else {
      cartItems.forEach((cartItem) => {
        result[cartItem.menu_item_id] = (result[cartItem.menu_item_id] || 0) + cartItem.quantity;
      });
    }

    logPerf('useMemo:quantitiesByMenuItemId', nowMs() - start, { itemCount: order ? orderItems.length : cartItems.length });
    return result;
  }, [order, orderItems, cartItems, pendingRoundItems]);

  const currentCategory = selectedCategoryId ? getCategoryById(selectedCategoryId) : undefined;
  const currentSubCategory = selectedSubCategoryId ? subCategories.find(c => toInt(c.id) === selectedSubCategoryId) : undefined;

  const allMenuItems = useMemo(() => {
    const start = nowMs();
    const result = selectedCategoryId ? getMenuItemsByCategory(selectedCategoryId) : [];
    logPerf('useMemo:allMenuItems', nowMs() - start, { categoryId: selectedCategoryId, count: result.length });
    return result;
  }, [selectedCategoryId, getMenuItemsByCategory]);

  // All items across every category — passed to MenuGrid to mount once
  const allItemsForGrid = useMemo(() => {
    return categories.length > 0 ? menuItems : [];
  }, [categories, menuItems]);

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
        <Text className="mt-4 text-pos-base text-pos-text-muted">Loading order...</Text>
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
    <PerfProfiler id="OrderScreenContent">
      <View className="flex-1 bg-surface">
      <View className="flex-1 flex-row">
        <View className="w-[30%]">
          <PerfProfiler id="OrderPanel">
              <OrderPanel
                order={order}
                items={itemsForPanel}
                guestCount={guestCount}
                onGuestCountChange={handleGuestCountChange}
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
          <View className="border-b border-border bg-surface-card px-4 py-3">
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-pos-lg font-bold text-pos-text">
                  {table?.table_number || `Table ${tableId}`}
                </Text>
                {order && (
                  <Text className="text-pos-xs text-pos-text-muted">
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
