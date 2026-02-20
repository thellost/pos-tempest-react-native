import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { OrderPanel } from '@/components/order/OrderPanel';
import { ORDER_TYPE } from '@/constants/enums';
import type { MenuItem, Order, OrderItem, OrderItemModifier } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { useMenu, type ModifierGroupWithModifiers } from '@/hooks/use-menu';
import { useTables } from '@/hooks/use-tables';
import type { SelectedModifier } from '@/services/order.service';
import {
    addItemToOrder,
    createOrder,
    getOrderWithItems,
    removeItemFromOrder,
    updateItemQuantity,
} from '@/services/order.service';

/**
 * Order screen - split layout with menu grid (left) and order panel (right).
 * Main POS order-taking screen (Toast POS style).
 */
export default function OrderScreen() {
  const { tableId, orderId } = useLocalSearchParams<{ tableId: string; orderId?: string }>();
  const { user } = useAuth();
  const { getTableById } = useTables();
  const { topLevelCategories, getMenuItemsByCategory, getModifierGroupsForMenuItem } = useMenu();

  const [table, setTable] = useState<any>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<(OrderItem & { modifiers: OrderItemModifier[] })[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modifier picker state
  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [menuItemModifiers, setMenuItemModifiers] = useState<ModifierGroupWithModifiers[]>([]);

  // Handle missing or invalid tableId
  if (!tableId || Array.isArray(tableId)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-pos-base text-pos-muted">Invalid table ID</Text>
      </View>
    );
  }

  const tableIdNum = parseInt(tableId, 10);
  const orderIdNum = orderId ? parseInt(orderId, 10) : null;

  // Load table and order data
  useEffect(() => {
    loadData();
  }, [tableId, orderId]);

  // Set default category when categories load
  useEffect(() => {
    if (topLevelCategories.length > 0 && !selectedCategoryId) {
      const firstCategoryId = typeof topLevelCategories[0].id === 'string'
        ? parseInt(topLevelCategories[0].id, 10)
        : topLevelCategories[0].id;
      setSelectedCategoryId(firstCategoryId);
    }
  }, [topLevelCategories]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load table
      const tableData = await getTableById(tableIdNum);
      setTable(tableData);

      // Load or create order
      if (orderIdNum) {
        // Load existing order
        const orderData = await getOrderWithItems(orderIdNum);
        if (orderData) {
          setOrder(orderData.order);
          setOrderItems(orderData.items);
          setGuestCount(orderData.order.guest_count || 0);
        }
      } else if (user && tableData) {
        // Create new order
        const newOrder = await createOrder(
          user.branch_id,
          tableIdNum,
          user.id,
          null, // shift_id - will be implemented in step 5
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

  // Handle menu item press
  const handleMenuItemPress = async (item: MenuItem) => {
    try {
      // Get modifier groups for this item
      const modifiers = await getModifierGroupsForMenuItem(
        typeof item.id === 'string' ? parseInt(item.id, 10) : item.id
      );

      if (modifiers.length > 0 || item.pricing_type === 'weight_based') {
        // Show modifier picker
        setSelectedMenuItem(item);
        setMenuItemModifiers(modifiers);
        setShowModifierPicker(true);
      } else {
        // Add directly to order
        await addItemToOrderHandler(item, [], null, '');
      }
    } catch (error) {
      console.error('[OrderScreen] Error handling menu item press:', error);
    }
  };

  // Handle adding item to order
  const addItemToOrderHandler = async (
    item: MenuItem,
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => {
    if (!order) return;

    try {
      await addItemToOrder(
        typeof order.id === 'string' ? parseInt(order.id, 10) : order.id,
        item,
        1,
        modifiers,
        notes,
        weight
      );

      // Reload order
      await loadData();
    } catch (error) {
      console.error('[OrderScreen] Error adding item to order:', error);
    }
  };

  // Handle modifier picker confirm
  const handleModifierConfirm = async (
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => {
    if (!selectedMenuItem) return;

    await addItemToOrderHandler(selectedMenuItem, modifiers, weight, notes);
    setShowModifierPicker(false);
    setSelectedMenuItem(null);
    setMenuItemModifiers([]);
  };

  // Handle quantity update
  const handleUpdateQuantity = async (itemId: number, newQuantity: number) => {
    try {
      await updateItemQuantity(itemId, newQuantity);
      await loadData();
    } catch (error) {
      console.error('[OrderScreen] Error updating quantity:', error);
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId: number) => {
    try {
      await removeItemFromOrder(itemId);
      await loadData();
    } catch (error) {
      console.error('[OrderScreen] Error removing item:', error);
    }
  };

  // Handle guest count change
  const handleGuestCountChange = async (count: number) => {
    setGuestCount(count);
    // TODO: Update order guest count in database
  };

  // Get menu items for selected category
  const menuItems = selectedCategoryId ? getMenuItemsByCategory(selectedCategoryId) : [];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-pos-base text-pos-muted">Loading order...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Split layout: 70% menu | 30% order panel */}
      <View className="flex-1 flex-row">
        {/* Left: Menu (70%) */}
        <View className="w-[70%] flex-1">
          {/* Header with table info */}
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

          {/* Category tabs */}
          <View className="bg-surface px-4 pt-4">
            <CategoryTabs
              categories={topLevelCategories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
            />
          </View>

          {/* Menu grid */}
          <MenuGrid items={menuItems} onItemPress={handleMenuItemPress} />
        </View>

        {/* Right: Order Panel (30%) */}
        <View className="w-[30%]">
          <OrderPanel
            order={order}
            items={orderItems}
            guestCount={guestCount}
            onGuestCountChange={handleGuestCountChange}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onSendToKitchen={() => {
              // TODO: Implement send to kitchen
              console.log('Send to Kitchen');
            }}
            onPayment={() => {
              // TODO: Implement payment
              console.log('Payment');
            }}
            onHold={() => {
              // TODO: Implement hold order
              console.log('Hold Order');
            }}
          />
        </View>
      </View>

      {/* Modifier Picker Modal */}
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
