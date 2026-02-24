import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, InteractionManager, Text, View } from 'react-native';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderPanel } from '@/components/order/OrderPanel';
import type { CartItem, OrderItemDisplay } from '@/components/order/types';
import { cartItemToDisplay, generateLocalId } from '@/components/order/types';
import { ORDER_STATUS, ORDER_TYPE, PRICING_TYPE } from '@/constants/enums';
import type { Order, OrderItem, OrderItemModifier } from '@/db/models';
import { powersync } from '@/db/provider';
import { useAuth } from '@/hooks/use-auth';
import { useMenu, type MenuItemWithInventory, type ModifierGroupWithModifiers } from '@/hooks/use-menu';
import type { SelectedModifier } from '@/services/order.service';
import {
    addItemToOrder,
    confirmOrder,
    createOrder,
    getOrderWithItems,
    removeItemFromOrder,
    updateItemModifiers,
    updateItemNotes,
    updateItemQuantity,
    updateItemUnitPrice,
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
  const router = useRouter();

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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemWithInventory | null>(null);
  const [menuItemModifiers, setMenuItemModifiers] = useState<ModifierGroupWithModifiers[]>([]);
  const [editingOrderItemId, setEditingOrderItemId] = useState<number | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editingItemNotes, setEditingItemNotes] = useState<string>('');
  const [editingItemModifiers, setEditingItemModifiers] = useState<SelectedModifier[]>([]);
  const [editingItemWeight, setEditingItemWeight] = useState<string>('');
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
    if (!user) return;

    if (order) {
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
    } else {
      const modifierTotal = modifiers.reduce((sum, m) => sum + m.extra_price, 0);
      const basePrice = weight ? item.price * weight : item.price;
      const total = basePrice + modifierTotal;
      const newCartItem: CartItem = {
        id: generateLocalId(),
        menu_item_id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
        menu_item_name: item.name,
        quantity: 1,
        unit_price: basePrice,
        modifier_total: modifierTotal,
        total: total,
        notes: notes || null,
        modifiers,
        weight,
      };
      setCartItems(prev => [...prev, newCartItem]);
    }
  }, [order, reloadOrder, user]);

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
      setCartItems(prev => prev.map(item => {
        if (item.id !== editingCartItemId) return item;
        const modifierTotal = modifiers.reduce((sum, m) => sum + m.extra_price, 0);
        const weightedUnitPrice = weight ? selectedMenuItem.price * weight : selectedMenuItem.price;
        const total = (weightedUnitPrice + modifierTotal) * item.quantity;
        return {
          ...item,
          modifiers,
          notes: notes || null,
          weight,
          unit_price: weightedUnitPrice,
          modifier_total: modifierTotal,
          total,
        };
      }));
      setEditingCartItemId(null);
      setEditingItemNotes('');
      setEditingItemModifiers([]);
      setEditingItemWeight('');
    } else if (editingOrderItemId) {
      await updateItemModifiers(editingOrderItemId, modifiers);
      if (selectedMenuItem.pricing_type === PRICING_TYPE.WEIGHT_BASED && weight && weight > 0) {
        await updateItemUnitPrice(editingOrderItemId, selectedMenuItem.price * weight);
      }
      await updateItemNotes(editingOrderItemId, notes);
      await reloadOrder();
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
  }, [selectedMenuItem, editingCartItemId, editingOrderItemId, cartItems, addItemToOrderHandler, reloadOrder]);

  const handleUpdateQuantity = useCallback(async (itemId: number | string, newQuantity: number) => {
    if (typeof itemId === 'string') {
      if (newQuantity <= 0) {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
      } else {
        setCartItems(prev => prev.map(item => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            quantity: newQuantity,
            total: (item.unit_price + item.modifier_total) * newQuantity,
          };
        }));
      }
    } else {
      try {
        await updateItemQuantity(itemId, newQuantity);
        await reloadOrder();
      } catch (error) {
        console.error('[OrderScreen] Error updating quantity:', error);
      }
    }
  }, [reloadOrder]);

  const handleRemoveItem = useCallback(async (itemId: number | string) => {
    if (typeof itemId === 'string') {
      setCartItems(prev => prev.filter(item => item.id !== itemId));
    } else {
      try {
        await removeItemFromOrder(itemId);
        await reloadOrder();
      } catch (error) {
        console.error('[OrderScreen] Error removing item:', error);
      }
    }
  }, [reloadOrder]);

  const handleUpdateNotes = useCallback(async (itemId: number, notes: string) => {
    try {
      await updateItemNotes(itemId, notes);
      await reloadOrder();
    } catch (error) {
      console.error('[OrderScreen] Error updating item notes:', error);
    }
  }, [reloadOrder]);

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
  }, []);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId(null);
  }, []);

  const handleSelectSubCategory = useCallback((subCategoryId: number | null) => {
    setSelectedSubCategoryId(subCategoryId);
  }, []);

  const handleSendToKitchen = useCallback(() => {
    Alert.alert('Kitchen', 'Send to kitchen is ready. Ticket workflow will be added in the next step.');
  }, []);

  const handlePayment = useCallback(() => {
    if (!order) {
      Alert.alert('Payment', 'No active order found. Please add items first.');
      return;
    }

    const currentOrderId = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
    router.push({ pathname: '/(app)/checkout/[orderId]', params: { orderId: String(currentOrderId) } });
  }, [order, router]);

  const handleHold = useCallback(() => {
    Alert.alert('Hold', 'Order hold action is clickable. Hold persistence will be added in the next step.');
  }, []);

  const handleConfirmOrder = useCallback(async () => {
    if (!user) return;
    if (cartItems.length === 0) return;

    try {
      const newOrder = await createOrder(
        user.branch_id,
        tableIdNum,
        user.id,
        null,
        ORDER_TYPE.DINE_IN,
        guestCount || 0
      );
      const orderId = typeof newOrder.id === 'string' ? parseInt(newOrder.id, 10) : newOrder.id;

      for (const cartItem of cartItems) {
        const menuItem = menuItems.find(m => {
          const mId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
          return mId === cartItem.menu_item_id;
        });
        if (menuItem) {
          await addItemToOrder(orderId, menuItem, cartItem.quantity, cartItem.modifiers, cartItem.notes, cartItem.weight);
        }
      }

      await confirmOrder(orderId);

      const orderData = await getOrderWithItems(orderId);
      if (orderData) {
        setOrder(orderData.order);
        setOrderItems(orderData.items);
      }
      setCartItems([]);
    } catch (error) {
      console.error('[OrderScreen] Error confirming order:', error);
    }
  }, [user, cartItems, tableIdNum, guestCount, menuItems]);

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

      try {
        await updateItemQuantity(targetItemId, currentQuantity - 1);
        await reloadOrder();
      } catch (error) {
        console.error('[OrderScreen] Error decrementing item quantity:', error);
      }
    } else {
      const matchingItems = cartItems.filter(cartItem => cartItem.menu_item_id === menuItemId);
      if (matchingItems.length === 0) return;

      const targetItem = matchingItems[matchingItems.length - 1];
      const newQuantity = targetItem.quantity - 1;

      if (newQuantity <= 0) {
        setCartItems(prev => prev.filter(item => item.id !== targetItem.id));
      } else {
        setCartItems(prev => prev.map(item => {
          if (item.id !== targetItem.id) return item;
          return {
            ...item,
            quantity: newQuantity,
            total: (item.unit_price + item.modifier_total) * newQuantity,
          };
        }));
      }
    }
  }, [order, orderItems, cartItems, reloadOrder]);

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
                onUpdateQuantity={handleUpdateQuantity}
                onEditModifiers={handleEditModifiers}
                onConfirmOrder={handleConfirmOrder}
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
