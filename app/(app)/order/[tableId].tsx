import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderPanel } from '@/components/order/OrderPanel';
import { ORDER_TYPE } from '@/constants/enums';
import type { Order, OrderItem, OrderItemModifier } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { useMenu, type MenuItemWithInventory, type ModifierGroupWithModifiers } from '@/hooks/use-menu';
import { useTables } from '@/hooks/use-tables';
import type { SelectedModifier } from '@/services/order.service';
import {
  addItemToOrder,
  createOrder,
  getOrderWithItems,
  removeItemFromOrder,
  updateItemQuantity,
} from '@/services/order.service';

export default function OrderScreen() {
  const { tableId, orderId } = useLocalSearchParams<{ tableId: string; orderId?: string }>();

  if (!tableId || Array.isArray(tableId)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-pos-base text-pos-muted">Invalid table ID</Text>
      </View>
    );
  }

  return <OrderScreenContent tableId={tableId} orderId={orderId} />;
}

interface OrderScreenContentProps {
  tableId: string;
  orderId?: string;
}

function OrderScreenContent({ tableId, orderId }: OrderScreenContentProps) {
  const tableIdNum = parseInt(tableId, 10);
  const orderIdNum = orderId ? parseInt(orderId, 10) : null;

  const { user } = useAuth();
  const { getTableById } = useTables();
  const {
    topLevelCategories,
    getSubCategories,
    getMenuItemsByCategory,
    getCategoryById,
    getModifierGroupsForMenuItem,
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

  const hasLoadedRef = useRef(false);

  const subCategories = selectedCategoryId ? getSubCategories(selectedCategoryId) : [];

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadData = async () => {
      try {
        setIsLoading(true);

        const tableData = await getTableById(tableIdNum);
        setTable(tableData);

        if (orderIdNum) {
          const orderData = await getOrderWithItems(orderIdNum);
          if (orderData) {
            setOrder(orderData.order);
            setOrderItems(orderData.items);
            setGuestCount(orderData.order.guest_count || 0);
          }
        } else if (user && tableData) {
          const newOrder = await createOrder(
            user.branch_id,
            tableIdNum,
            user.id,
            null,
            ORDER_TYPE.DINE_IN,
            0
          );
          setOrder(newOrder);
          setOrderItems([]);
        }
      } catch (error) {
        console.error('[OrderScreen] Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tableIdNum, orderIdNum, user, getTableById]);

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
    const orderData = await getOrderWithItems(currentOrderId);
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
      await addItemToOrder(currentOrderId, item, 1, modifiers, notes, weight);
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

  const currentCategory = selectedCategoryId ? getCategoryById(selectedCategoryId) : undefined;
  const allMenuItems = selectedCategoryId ? getMenuItemsByCategory(selectedCategoryId) : [];
  const menuItems = selectedSubCategoryId
    ? allMenuItems.filter(item => {
        const itemCategoryId = typeof item.category_id === 'string'
          ? parseInt(item.category_id as string, 10)
          : item.category_id;
        return itemCategoryId === selectedSubCategoryId;
      })
    : allMenuItems;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#803500" />
        <Text className="mt-4 text-pos-base text-pos-muted">Loading order...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1 flex-row">
        <View className="w-[70%] flex-1">
          <View className="border-b border-white/10 bg-surface-soft px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-pos-xl font-bold text-pos-text-strong">
                  {table?.table_number || `Table ${tableId}`}
                </Text>
                {order && (
                  <Text className="text-pos-xs text-pos-muted">
                    {order.order_number}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <CategoryTabs
            categories={topLevelCategories}
            subCategories={subCategories}
            selectedCategoryId={selectedCategoryId}
            selectedSubCategoryId={selectedSubCategoryId}
            onSelectCategory={handleSelectCategory}
            onSelectSubCategory={handleSelectSubCategory}
          />

          <MenuGrid
            items={menuItems}
            category={currentCategory}
            onItemPress={handleMenuItemPress}
          />
        </View>

        <View className="w-[30%]">
          <OrderPanel
            order={order}
            items={orderItems}
            guestCount={guestCount}
            onGuestCountChange={handleGuestCountChange}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onSendToKitchen={() => {
              console.log('Send to Kitchen');
            }}
            onPayment={() => {
              console.log('Payment');
            }}
            onHold={() => {
              console.log('Hold Order');
            }}
          />
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
  );
}
