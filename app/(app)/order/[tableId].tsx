import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { MenuSearchBar } from '@/components/menu/MenuSearchBar';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderPanel } from '@/components/order/OrderPanel';
import type { OrderItemDisplay } from '@/components/order/types';
import { cartItemToDisplay } from '@/components/order/types';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import { ORDER_STATUS, PRICING_TYPE } from '@/constants/enums';
import { powersync } from '@/db/provider';
import { useMenu, type MenuItemWithInventory, type ModifierGroupWithModifiers } from '@/hooks/use-menu';
import { useOrder } from '@/hooks/use-order';
import { useShift } from '@/hooks/use-shift';
import type { SelectedModifier } from '@/services/order.service';
import { PerfProfiler, logPerf, nowMs, timedAsync, useMountTimer } from '@/utils/perf-debug';

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

  const { isShiftOpen } = useShift();

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

  // Modifier picker UI state
  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemWithInventory | null>(null);
  const [menuItemModifiers, setMenuItemModifiers] = useState<ModifierGroupWithModifiers[]>([]);
  const [editingOrderItemId, setEditingOrderItemId] = useState<number | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editingItemNotes, setEditingItemNotes] = useState<string>('');
  const [editingItemModifiers, setEditingItemModifiers] = useState<SelectedModifier[]>([]);
  const [editingItemWeight, setEditingItemWeight] = useState<string>('');

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
  });

  const isLoading = orderLoading;

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
      console.error('[OrderScreen] Error handling menu item press:', error);
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

  const handleHold = useCallback(() => {
    Alert.alert('Hold', 'Order hold action is clickable. Hold persistence will be added in the next step.');
  }, []);

  const handlePrintBill = useCallback(async () => {
    await printBill();
  }, [printBill]);

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
  const allItemsForGrid = useMemo(() => {
    return categories.length > 0 ? menuItems : [];
  }, [categories, menuItems]);

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

        return {
          ...item,
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
                onHold={handleHold}
                pendingRoundItems={pendingRoundItemsDisplay}
                currentRound={currentRound}
                roundSentAt={roundSentAt}
                onConfirmRound={handleConfirmRound}
                onCancelRound={handleCancelRound}
                onPrintBill={handlePrintBill}
                isShiftOpen={isShiftOpen}
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
