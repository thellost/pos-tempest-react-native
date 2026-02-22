import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Text, View } from 'react-native';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderPanel } from '@/components/order/OrderPanel';
import { ORDER_STATUS, ORDER_TYPE } from '@/constants/enums';
import type { Order, OrderItem, OrderItemModifier } from '@/db/models';
import { powersync } from '@/db/provider';
import { useAuth } from '@/hooks/use-auth';
import { useMenu, type MenuItemWithInventory, type ModifierGroupWithModifiers } from '@/hooks/use-menu';
import type { SelectedModifier } from '@/services/order.service';
import {
  addItemToOrder,
  createOrder,
  getOrderWithItems,
  removeItemFromOrder,
  updateItemQuantity,
} from '@/services/order.service';
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

  const { user } = useAuth();
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
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<(OrderItem & { modifiers: OrderItemModifier[] })[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemWithInventory | null>(null);
  const [menuItemModifiers, setMenuItemModifiers] = useState<ModifierGroupWithModifiers[]>([]);
  const [isMenuGridReady, setIsMenuGridReady] = useState(false);

  const hasLoadedRef = useRef(false);

  const subCategories = selectedCategoryId ? getSubCategories(selectedCategoryId) : [];

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadData = async () => {
      const loadStart = nowMs();
      try {
        setIsLoading(true);

        const tableData = await timedAsync(
          'query:getTableById',
          () => getOrderTableById(tableIdNum),
          { tableId: tableIdNum }
        );
        setTable(tableData);

        if (orderIdNum) {
          const orderData = await timedAsync(
            'query:getOrderWithItems',
            () => getOrderWithItems(orderIdNum),
            { orderId: orderIdNum }
          );
          if (orderData) {
            setOrder(orderData.order);
            setOrderItems(orderData.items);
            setGuestCount(orderData.order.guest_count || 0);
          }
        } else if (user && tableData) {
          const newOrder = await timedAsync(
            'query:createOrder',
            () => createOrder(
              user.branch_id,
              tableIdNum,
              user.id,
              null,
              ORDER_TYPE.DINE_IN,
              0
            ),
            { branchId: user.branch_id, tableId: tableIdNum }
          );
          setOrder(newOrder);
          setOrderItems([]);
        }
      } catch (error) {
        console.error('[OrderScreen] Error loading data:', error);
      } finally {
        setIsLoading(false);
        logPerf('loadData:total', nowMs() - loadStart);
        logPerf('OrderScreen:bootToDataReady', nowMs() - screenBootRef.current);
      }
    };

    loadData();
  }, [tableIdNum, orderIdNum, user]);

  useEffect(() => {
    if (topLevelCategories.length > 0 && !selectedCategoryId) {
      const firstCategoryId = typeof topLevelCategories[0].id === 'string'
        ? parseInt(topLevelCategories[0].id, 10)
        : topLevelCategories[0].id;
      setSelectedCategoryId(firstCategoryId);
    }
  }, [topLevelCategories, selectedCategoryId]);

  const reloadOrder = useCallback(async () => {
    if (!order) return;
    const currentOrderId = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
    const orderData = await timedAsync(
      'query:reloadOrder',
      () => getOrderWithItems(currentOrderId),
      { orderId: currentOrderId }
    );
    if (orderData) {
      setOrder(orderData.order);
      setOrderItems(orderData.items);
    }
  }, [order]);

  const addItemToOrderHandler = useCallback(async (
    item: MenuItemWithInventory,
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => {
    if (!order) return;

    try {
      const currentOrderId = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
      await timedAsync(
        'query:addItemToOrder',
        () => addItemToOrder(currentOrderId, item, 1, modifiers, notes, weight),
        { orderId: currentOrderId, menuItem: item.name }
      );
      await reloadOrder();
    } catch (error) {
      console.error('[OrderScreen] Error adding item to order:', error);
    }
  }, [order, reloadOrder]);

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

    await addItemToOrderHandler(selectedMenuItem, modifiers, weight, notes);
    setShowModifierPicker(false);
    setSelectedMenuItem(null);
    setMenuItemModifiers([]);
  }, [selectedMenuItem, addItemToOrderHandler]);

  const handleUpdateQuantity = useCallback(async (itemId: number, newQuantity: number) => {
    try {
      await updateItemQuantity(itemId, newQuantity);
      await reloadOrder();
    } catch (error) {
      console.error('[OrderScreen] Error updating quantity:', error);
    }
  }, [reloadOrder]);

  const handleRemoveItem = useCallback(async (itemId: number) => {
    try {
      await removeItemFromOrder(itemId);
      await reloadOrder();
    } catch (error) {
      console.error('[OrderScreen] Error removing item:', error);
    }
  }, [reloadOrder]);

  const handleGuestCountChange = useCallback((count: number) => {
    setGuestCount(count);
  }, []);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId(null);
  }, []);

  const handleSelectSubCategory = useCallback((subCategoryId: number | null) => {
    setSelectedSubCategoryId(subCategoryId);
  }, []);

  const handleSendToKitchen = useCallback(() => {
    console.log('Send to Kitchen');
  }, []);

  const handlePayment = useCallback(() => {
    console.log('Payment');
  }, []);

  const handleHold = useCallback(() => {
    console.log('Hold Order');
  }, []);

  const quantitiesByMenuItemId = useMemo<Record<number, number>>(() => {
    const start = nowMs();
    const result = orderItems.reduce<Record<number, number>>((accumulator, orderItem) => {
      if (orderItem.is_voided) {
        return accumulator;
      }

      const menuItemId = typeof orderItem.menu_item_id === 'string'
        ? parseInt(orderItem.menu_item_id as string, 10)
        : orderItem.menu_item_id;
      const quantity = typeof orderItem.quantity === 'string'
        ? parseInt(orderItem.quantity as string, 10)
        : orderItem.quantity;

      accumulator[menuItemId] = (accumulator[menuItemId] || 0) + quantity;
      return accumulator;
    }, {});
    logPerf('useMemo:quantitiesByMenuItemId', nowMs() - start, { itemCount: orderItems.length });
    return result;
  }, [orderItems]);

  const handleMenuItemDecrement = useCallback(async (item: MenuItemWithInventory) => {
    const menuItemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;

    const matchingItems = orderItems.filter((orderItem) => {
      const orderMenuItemId = typeof orderItem.menu_item_id === 'string'
        ? parseInt(orderItem.menu_item_id as string, 10)
        : orderItem.menu_item_id;
      return orderMenuItemId === menuItemId && !orderItem.is_voided;
    });

    if (matchingItems.length === 0) {
      return;
    }

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

    try {
      await updateItemQuantity(targetItemId, currentQuantity - 1);
      await reloadOrder();
    } catch (error) {
      console.error('[OrderScreen] Error decrementing item quantity:', error);
    }
  }, [orderItems, reloadOrder]);

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
  
  const menuItemsList = useMemo(() => {
    const start = nowMs();
    let result: MenuItemWithInventory[];
    if (!selectedSubCategoryId) {
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
  }, [allMenuItems, selectedSubCategoryId]);

  useEffect(() => {
    if (menuItemsList.length === 0) {
      setIsMenuGridReady(false);
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setIsMenuGridReady(true);
    });

    return () => {
      task.cancel();
    };
  }, [menuItemsList]);

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
              items={orderItems}
              guestCount={guestCount}
              onGuestCountChange={handleGuestCountChange}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onSendToKitchen={handleSendToKitchen}
              onPayment={handlePayment}
              onHold={handleHold}
            />
          </PerfProfiler>
        </View>

        <View className="w-[70%] flex-1">
          <View className="border-b border-border bg-surface-card px-5 py-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-pos-2xl font-bold text-pos-text">
                  {table?.table_number || `Table ${tableId}`}
                </Text>
                {order && (
                  <Text className="mt-1 text-pos-sm text-pos-text-muted">
                    {order.order_number}
                  </Text>
                )}
              </View>
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

          {isMenuGridReady ? (
            <PerfProfiler id="MenuGrid">
              <MenuGrid
                items={menuItemsList}
                category={currentCategory}
                subCategoryName={currentSubCategory?.name}
                quantitiesByMenuItemId={quantitiesByMenuItemId}
                onItemPress={handleMenuItemPress}
                onDecrementItem={handleMenuItemDecrement}
              />
            </PerfProfiler>
          ) : (
            <View className="flex-1 items-center justify-center bg-surface">
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          )}
        </View>
      </View>

      {selectedMenuItem && (
        <ModifierPicker
          visible={showModifierPicker}
          menuItem={selectedMenuItem}
          modifierGroups={menuItemModifiers}
          onConfirm={handleModifierConfirm}
          onCancel={() => {
            setShowModifierPicker(false);
            setSelectedMenuItem(null);
            setMenuItemModifiers([]);
          }}
        />
      )}
      </View>
    </PerfProfiler>
  );
}
