import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useRouter } from 'expo-router';

import type { AssignedCustomer } from '@/components/order/CustomerPickerRow';
import type { OrderItemDisplay } from '@/components/order/types';
import { cartItemToDisplay } from '@/components/order/types';
import { ORDER_STATUS } from '@/constants/enums';
import { powersync } from '@/db/provider';
import { useAuth } from '@/hooks/use-auth';
import { useMenu, type MenuItemWithInventory } from '@/hooks/use-menu';
import { useModifierPicker } from '@/hooks/use-modifier-picker';
import { useOrder } from '@/hooks/use-order';
import { useShift } from '@/hooks/use-shift';
import { assignCustomerToOrder, confirmOrder as confirmOrderService, setGuestNameOnOrder } from '@/services/order.service';
import { logPerf, nowMs, timedAsync } from '@/utils/perf-debug';
import { toInt, toIntOrNull } from '@/utils/coerce';

interface OrderTableData {
  id: number | string;
  table_number: string;
  floor_area_name: string;
  active_order_id: string | null;
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
      [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.SERVED, tableId]
    );
    return result || null;
  } catch (error) {
    console.error('[useOrderScreen] Error fetching table:', error);
    return null;
  }
}

export interface UseOrderScreenOptions {
  orderType: 'dine-in' | 'takeaway';
  tableId: number | null;
  orderId: string | null;
}

export function useOrderScreen({ orderType, tableId, orderId }: UseOrderScreenOptions) {
  const screenLabel = orderType === 'takeaway' ? 'TakeawayOrder' : 'OrderScreen';
  const screenBootRef = useRef(nowMs());

  const router = useRouter();

  const { user } = useAuth();
  const { isShiftOpen, activeShift } = useShift();

  const {
    topLevelCategories,
    getSubCategories,
    getMenuItemsByCategory,
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
  const [guestName, setGuestNameState] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [table, setTable] = useState<OrderTableData | null>(null);
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const hasLoadedTableIdRef = useRef<number | null>(null);
  const hasBootLoggedRef = useRef(false);

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
    setGuestCount,
    updateCartItem,
    reload,
  } = useOrder({
    tableId,
    orderId,
    orderType,
    menuItems,
    isShiftOpen,
    shiftId: activeShift ? activeShift.id : null,
    guestName,
  });

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
    logTag: screenLabel,
  });

  const isLoading = orderLoading;

  // Load table data for dine-in only
  useEffect(() => {
    if (orderType !== 'dine-in' || tableId === null) return;
    if (hasLoadedTableIdRef.current === tableId) return;

    const loadStart = nowMs();
    timedAsync('query:getTableById', () => getOrderTableById(tableId), { tableId })
      .then((data) => {
        setTable(data);
        hasLoadedTableIdRef.current = tableId;
      })
      .catch((error) => console.error('[useOrderScreen] Error loading table:', error))
      .finally(() => {
        logPerf('loadData:total', nowMs() - loadStart);
        logPerf(`${screenLabel}:bootToDataReady`, nowMs() - screenBootRef.current);
      });
  }, [orderType, tableId, screenLabel]);

  // Log boot time once (takeaway path — dine-in logs inline in table load effect)
  useEffect(() => {
    if (orderType !== 'takeaway') return;
    if (!isLoading && !menuLoading && !menuHydrating && !hasBootLoggedRef.current) {
      hasBootLoggedRef.current = true;
      logPerf(`${screenLabel}:bootToDataReady`, nowMs() - screenBootRef.current);
    }
  }, [orderType, isLoading, menuLoading, menuHydrating, screenLabel]);

  // Auto-select first category
  useEffect(() => {
    if (topLevelCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(toInt(topLevelCategories[0].id));
    }
  }, [topLevelCategories, selectedCategoryId]);

  // Load assigned customer when order changes
  useEffect(() => {
    setGuestNameState(order?.customer_name ?? null);

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
  }, [order?.customer_id, order?.customer_name]);

  const handleAssignCustomer = useCallback(async (customer: AssignedCustomer) => {
    const currentOrderId = order ? order.id : null;
    if (currentOrderId) {
      try {
        await assignCustomerToOrder(currentOrderId, customer.id);
      } catch (err) {
        console.error(`[${screenLabel}] assignCustomerToOrder error:`, err);
      }
    }
    setAssignedCustomer(customer);
  }, [order, screenLabel]);

  const handleClearCustomer = useCallback(async () => {
    const currentOrderId = order ? order.id : null;
    if (currentOrderId) {
      try {
        await assignCustomerToOrder(currentOrderId, null);
      } catch (err) {
        console.error(`[${screenLabel}] clearCustomer error:`, err);
      }
    }
    setAssignedCustomer(null);
  }, [order, screenLabel]);

  const handleSetGuestName = useCallback(async (name: string) => {
    if (order?.id) {
      try {
        await setGuestNameOnOrder(order.id, name);
        await reload();
      } catch (err) {
        console.error(`[${screenLabel}] setGuestNameOnOrder error:`, err);
      }
    }
    setGuestNameState(name);
  }, [order, screenLabel, reload]);

  const handleClearGuestName = useCallback(async () => {
    if (order?.id) {
      try {
        await setGuestNameOnOrder(order.id, null);
        await reload();
      } catch (err) {
        console.error(`[${screenLabel}] clearGuestName error:`, err);
      }
    }
    setGuestNameState(null);
  }, [order, screenLabel, reload]);

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
    const reason = orderType === 'takeaway'
      ? 'Cancelled from takeaway order panel'
      : 'Cancelled from dine-in order panel';
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
                await cancelOrder(reason);
                Alert.alert('Order Cancelled', 'Order has been marked as cancelled.');
              } catch (error) {
                console.error(`[${screenLabel}] Error cancelling order:`, error);
                Alert.alert('Error', 'Failed to cancel order.');
              }
            })();
          },
        },
      ]
    );
  }, [order, cancelOrder, orderType, screenLabel]);

  const handlePrintBill = useCallback(async () => {
    await printBill();
  }, [printBill]);

  const handleMoveTable = useCallback(() => {
    setShowMoveTableModal(true);
  }, []);

  const handleMoveTableComplete = useCallback((newTableId: number) => {
    setShowMoveTableModal(false);
    router.replace({
      pathname: '/(app)/order/[tableId]',
      params: { tableId: newTableId.toString(), orderId: order?.id ?? '' },
    });
  }, [order?.id, router]);

  // For takeaway: confirm existing draft via DB service, or delegate new order to hook.
  // For dine-in: delegate directly to hook's confirmOrder.
  const handleConfirmOrder = useCallback(async () => {
    if (orderType === 'dine-in') {
      await confirmOrderHook();
      return;
    }
    // Takeaway path
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (order) {
        if (!user) throw new Error('Cashier id is not provided');
        await confirmOrderService(order.id, toInt(user.id));
        await reload();
      } else {
        await confirmOrderHook();
      }
      Alert.alert('Pesanan Dikonfirmasi', 'Pesanan berhasil dibuat.');
    } catch (error) {
      console.error(`[${screenLabel}] Error confirming order:`, error);
      Alert.alert('Error', 'Gagal mengkonfirmasi pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  }, [orderType, isSubmitting, order, user, confirmOrderHook, reload, screenLabel]);

  const hasConfirmedOrActiveOrderStatus = useMemo(() => {
    const orderStatus = order?.status;
    return (
      orderStatus === ORDER_STATUS.CONFIRMED ||
      orderStatus === ORDER_STATUS.PREPARING ||
      orderStatus === ORDER_STATUS.READY ||
      orderStatus === ORDER_STATUS.SERVED ||
      orderStatus === ORDER_STATUS.COMPLETED
    );
  }, [order?.status]);

  const findConfirmedOrSentPersistedItem = useCallback((itemId: string) => {
    const persistedItem = orderItems.find((item) => item.id === itemId);
    if (!persistedItem || persistedItem.is_voided) return null;

    const isSentRoundItem = roundSentAt.has(persistedItem.round_number || 1);

    return hasConfirmedOrActiveOrderStatus || isSentRoundItem ? persistedItem : null;
  }, [hasConfirmedOrActiveOrderStatus, orderItems, roundSentAt]);

  const confirmConfirmedItemDelete = useCallback((
    itemName: string,
    onConfirm: () => void
  ) => {
    Alert.alert(
      'Delete Confirmed Item',
      `${itemName} has already been confirmed/sent. Deleting it will affect this order.`,
      [
        { text: 'Keep Item', style: 'cancel' },
        {
          text: 'Delete Item',
          style: 'destructive',
          onPress: onConfirm,
        },
      ]
    );
  }, []);

  const handleUpdateQuantity = useCallback((itemId: string, newQuantity: number) => {
    if (newQuantity > 0) {
      void updateQuantity(itemId, newQuantity);
      return;
    }

    const confirmedOrSentItem = findConfirmedOrSentPersistedItem(itemId);
    if (!confirmedOrSentItem) {
      void updateQuantity(itemId, newQuantity);
      return;
    }

    confirmConfirmedItemDelete(confirmedOrSentItem.menu_item_name, () => {
      void updateQuantity(itemId, newQuantity);
    });
  }, [confirmConfirmedItemDelete, findConfirmedOrSentPersistedItem, updateQuantity]);

  const handleRemoveItem = useCallback((itemId: string) => {
    const confirmedOrSentItem = findConfirmedOrSentPersistedItem(itemId);
    if (!confirmedOrSentItem) {
      void removeItem(itemId);
      return;
    }

    confirmConfirmedItemDelete(confirmedOrSentItem.menu_item_name, () => {
      void removeItem(itemId);
    });
  }, [confirmConfirmedItemDelete, findConfirmedOrSentPersistedItem, removeItem]);

  const handleMenuItemDecrement = useCallback(async (item: MenuItemWithInventory) => {
    const menuItemId = toInt(item.id);
    if (order) {
      // Menu-grid decrement is scoped to staged/unconfirmed quantities. Prefer
      // local pending-round items (not yet persisted); confirmed/sent persisted
      // cart rows are edited from the cart instead of the menu badge.
      const pendingMatches = pendingRoundItems.filter((pi) => pi.menu_item_id === menuItemId);
      if (pendingMatches.length > 0) {
        const target = pendingMatches[pendingMatches.length - 1];
        await updateQuantity(target.id, target.quantity - 1);
        return;
      }
      // Only decrement persisted items while their round has not been sent yet.
      // Sent/confirmed persisted items remain editable from cart row controls.
      const editableMatches = orderItems.filter(
        (oi) =>
          toInt(oi.menu_item_id) === menuItemId &&
          !oi.is_voided &&
          !hasConfirmedOrActiveOrderStatus &&
          !roundSentAt.has(oi.round_number || 1)
      );
      if (editableMatches.length === 0) return;
      const target = editableMatches
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const nextQuantity = toInt(target.quantity) - 1;
      if (nextQuantity <= 0) {
        handleUpdateQuantity(String(target.id), nextQuantity);
        return;
      }
      await updateQuantity(String(target.id), nextQuantity);
    } else {
      const matchingItems = cartItems.filter((ci) => ci.menu_item_id === menuItemId);
      if (matchingItems.length === 0) return;
      const target = matchingItems[matchingItems.length - 1];
      await updateQuantity(target.id, target.quantity - 1);
    }
  }, [order, orderItems, cartItems, pendingRoundItems, roundSentAt, updateQuantity, handleUpdateQuantity, hasConfirmedOrActiveOrderStatus]);

  const handleGuestCountChange = useCallback((count: number) => {
    if (orderType !== 'takeaway') setGuestCount(count);
  }, [orderType, setGuestCount]);

  // ─── Memos ──────────────────────────────────────────────────────────────────

  const subCategories = useMemo(
    () => (selectedCategoryId ? getSubCategories(selectedCategoryId) : []),
    [selectedCategoryId, getSubCategories]
  );

  const quantitiesByMenuItemId = useMemo<Record<number, number>>(() => {
    const start = nowMs();
    const result: Record<number, number> = {};
    if (order) {
      orderItems.forEach((oi) => {
        if (oi.is_voided) return;
        // Menu badges mirror the menu-grid decrement target: only staged or
        // unconfirmed quantities are counted here. Confirmed/sent persisted cart
        // rows are still editable from the cart, but excluded from menu badges.
        if (hasConfirmedOrActiveOrderStatus) return;
        if (roundSentAt.has(oi.round_number || 1)) return;
        const id = toInt(oi.menu_item_id);
        result[id] = (result[id] || 0) + toInt(oi.quantity);
      });
      // Pending round items can exist for both dine-in AND takeaway once the order
      // is CONFIRMED/PREPARING (see use-order.ts addItemToOrderHandler), so always
      // include them — otherwise the menu badge desyncs from handleMenuItemDecrement.
      pendingRoundItems.forEach((pi) => {
        result[pi.menu_item_id] = (result[pi.menu_item_id] || 0) + pi.quantity;
      });
    } else {
      cartItems.forEach((ci) => {
        result[ci.menu_item_id] = (result[ci.menu_item_id] || 0) + ci.quantity;
      });
    }
    logPerf('useMemo:quantitiesByMenuItemId', nowMs() - start, {
      itemCount: order ? orderItems.length : cartItems.length,
    });
    return result;
  }, [order, orderItems, cartItems, pendingRoundItems, roundSentAt, hasConfirmedOrActiveOrderStatus]);

  const allMenuItems = useMemo(() => {
    const start = nowMs();
    const result = selectedCategoryId ? getMenuItemsByCategory(selectedCategoryId) : [];
    logPerf('useMemo:allMenuItems', nowMs() - start, { categoryId: selectedCategoryId, count: result.length });
    return result;
  }, [selectedCategoryId, getMenuItemsByCategory]);

  const allItemsForGrid = useMemo(
    () => (categories.length > 0 ? menuItems : []),
    [categories, menuItems]
  );

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
      result = menuItems.filter((item) => item.name.toLowerCase().includes(query));
    } else if (!selectedSubCategoryId) {
      result = allMenuItems;
    } else {
      result = allMenuItems.filter((item) => toIntOrNull(item.category_id) === selectedSubCategoryId);
    }
    logPerf('useMemo:menuItemsList', nowMs() - start, { subCategoryId: selectedSubCategoryId, count: result.length });
    return result;
  }, [searchQuery, menuItems, allMenuItems, selectedSubCategoryId]);

  const menuCategoryByItemId = useMemo(() => {
    // Build O(M) lookup first to avoid O(N×M) find() in the item loop below
    const catLookup = new Map<number, { id: number; name: string }>();
    categories.forEach((cat) => {
      catLookup.set(toInt(cat.id), { id: toInt(cat.id), name: cat.name });
    });
    const map = new Map<number, { id: number; name: string }>();
    menuItems.forEach((item) => {
      const categoryId = toIntOrNull(item.category_id);
      if (categoryId === null) return;
      const category = catLookup.get(categoryId);
      if (category) map.set(toInt(item.id), category);
    });
    return map;
  }, [menuItems, categories]);

  const topLevelCategoryById = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    categories.forEach((category) => {
      const catId = toInt(category.id);
      if (toIntOrNull(category.parent_id) === null) {
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
        if (parent) map.set(catId, parent);
      }
    });
    return map;
  }, [categories, topLevelCategoryById]);

  const resolveGroupName = useCallback((categoryId: number | null | undefined): string => {
    if (categoryId == null) return 'Other';
    const category = menuCategoryByItemId.get(categoryId);
    if (!category) return 'Other';
    const parentName = topLevelBySubCategoryId.get(category.id)?.name;
    const isTopLevel = topLevelCategoryById.has(category.id);
    return !isTopLevel && parentName ? parentName : category.name;
  }, [menuCategoryByItemId, topLevelBySubCategoryId, topLevelCategoryById]);

  const itemsForPanel = useMemo<OrderItemDisplay[]>(() => {
    if (order) {
      return orderItems.map((item) => {
        const groupName = resolveGroupName(toInt(item.menu_item_id));
        return {
          ...item,
          category_group: groupName,
        } as OrderItemDisplay;
      });
    }
    return cartItems.map((item) => cartItemToDisplay(item, resolveGroupName(item.menu_item_id)));
  }, [order, orderItems, cartItems, resolveGroupName]);

  const pendingRoundItemsDisplay = useMemo<OrderItemDisplay[]>(
    () => pendingRoundItems.map((item) => cartItemToDisplay(item, resolveGroupName(item.menu_item_id))),
    [pendingRoundItems, resolveGroupName]
  );

  return {
    // Loading
    isLoading,
    menuLoading,
    menuHydrating,
    categories,
    menuItems,
    // Order core
    order,
    isShiftOpen,
    currentRound,
    roundSentAt,
    guestCount: orderType === 'takeaway' ? null : guestCount,
    lastKOT,
    lastBill,
    updateQuantity: handleUpdateQuantity,
    removeItem: handleRemoveItem,
    dismissKOT,
    dismissBill,
    handleConfirmRound,
    handleCancelRound,
    handleGuestCountChange,
    // Modifier picker
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
    handleModifierCancel,
    // Customer
    assignedCustomer,
    handleAssignCustomer,
    handleClearCustomer,
    guestName,
    handleSetGuestName,
    handleClearGuestName,
    // Category nav
    topLevelCategories,
    subCategories,
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    selectedSubCategoryId,
    handleSelectCategory,
    handleSelectSubCategory,
    // Computed
    menuItemsList,
    allItemsForGrid,
    categoryById,
    quantitiesByMenuItemId,
    itemsForPanel,
    pendingRoundItemsDisplay,
    // Actions
    handleSendToKitchen,
    handlePayment,
    handleCancelOrder,
    handlePrintBill,
    handleConfirmOrder,
    handleMenuItemDecrement,
    handleMoveTable,
    handleMoveTableComplete,
    // Move table modal
    showMoveTableModal,
    setShowMoveTableModal,
    // Dine-in specific
    table,
  };
}
