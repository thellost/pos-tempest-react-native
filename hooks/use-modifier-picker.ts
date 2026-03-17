import { useCallback, useState } from 'react';

import type { CartItem } from '@/components/order/types';
import { PRICING_TYPE } from '@/constants/enums';
import type { MenuItemWithInventory, ModifierGroupWithModifiers } from '@/hooks/use-menu';
import type { SelectedModifier } from '@/services/order.service';
import { toInt } from '@/utils/coerce';

// Minimal shape of an order item that the hook needs
interface OrderItemForPicker {
  id: number | string;
  menu_item_id: number | string;
  notes: string | null;
  unit_price: number;
  modifiers: Array<{
    modifier_id: number | string;
    modifier_name: string;
    modifier_group_name: string;
    extra_price: number;
  }>;
}

interface UseModifierPickerOptions {
  cartItems: CartItem[];
  orderItems: OrderItemForPicker[];
  menuItems: MenuItemWithInventory[];
  getModifierGroupsForMenuItem: (id: number) => Promise<ModifierGroupWithModifiers[]>;
  addItemToOrder: (
    item: MenuItemWithInventory,
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => Promise<void>;
  updateCartItem: (id: string, updates: Partial<CartItem>) => void;
  editModifiers: (
    itemId: number | string,
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string,
    unitPrice?: number
  ) => Promise<void>;
  logTag?: string;
}

interface UseModifierPickerReturn {
  showModifierPicker: boolean;
  selectedMenuItem: MenuItemWithInventory | null;
  menuItemModifiers: ModifierGroupWithModifiers[];
  editingItemModifiers: SelectedModifier[];
  editingItemNotes: string;
  editingItemWeight: string;
  isEditing: boolean;
  handleMenuItemPress: (item: MenuItemWithInventory) => Promise<void>;
  handleModifierConfirm: (
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => Promise<void>;
  handleEditModifiers: (itemId: number | string) => Promise<void>;
  handleCancel: () => void;
}

export function useModifierPicker({
  cartItems,
  orderItems,
  menuItems,
  getModifierGroupsForMenuItem,
  addItemToOrder,
  updateCartItem,
  editModifiers,
  logTag = 'ModifierPicker',
}: UseModifierPickerOptions): UseModifierPickerReturn {
  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemWithInventory | null>(null);
  const [menuItemModifiers, setMenuItemModifiers] = useState<ModifierGroupWithModifiers[]>([]);
  const [editingOrderItemId, setEditingOrderItemId] = useState<number | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editingItemNotes, setEditingItemNotes] = useState<string>('');
  const [editingItemModifiers, setEditingItemModifiers] = useState<SelectedModifier[]>([]);
  const [editingItemWeight, setEditingItemWeight] = useState<string>('');

  const reset = useCallback(() => {
    setShowModifierPicker(false);
    setSelectedMenuItem(null);
    setMenuItemModifiers([]);
    setEditingOrderItemId(null);
    setEditingCartItemId(null);
    setEditingItemNotes('');
    setEditingItemModifiers([]);
    setEditingItemWeight('');
  }, []);

  const handleMenuItemPress = useCallback(async (item: MenuItemWithInventory) => {
    try {
      const itemId = toInt(item.id);
      const modifiers = await getModifierGroupsForMenuItem(itemId);
      const isWeightBased = item.pricing_type === 'weight_based';

      if (modifiers.length > 0 || isWeightBased) {
        setSelectedMenuItem(item);
        setMenuItemModifiers(modifiers);
        setShowModifierPicker(true);
      } else {
        await addItemToOrder(item, [], null, '');
      }
    } catch (error) {
      console.error(`[${logTag}] Error handling menu item press:`, error);
    }
  }, [getModifierGroupsForMenuItem, addItemToOrder, logTag]);

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
    } else if (editingOrderItemId) {
      const unitPrice = selectedMenuItem.pricing_type === PRICING_TYPE.WEIGHT_BASED && weight && weight > 0
        ? selectedMenuItem.price * weight
        : undefined;
      await editModifiers(editingOrderItemId, modifiers, weight, notes, unitPrice);
    } else {
      await addItemToOrder(selectedMenuItem, modifiers, weight, notes);
    }
    reset();
  }, [selectedMenuItem, editingCartItemId, editingOrderItemId, cartItems, updateCartItem, editModifiers, addItemToOrder, reset]);

  const handleEditModifiers = useCallback(async (itemId: number | string) => {
    if (typeof itemId === 'string') {
      const cartItem = cartItems.find(item => item.id === itemId);
      if (!cartItem) return;

      const menuItem = menuItems.find(m => toInt(m.id) === cartItem.menu_item_id);
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
      const targetItem = orderItems.find((item) => toInt(item.id) === itemId);
      if (!targetItem) return;

      const menuItemId = toInt(targetItem.menu_item_id);
      const menuItem = menuItems.find((item) => toInt(item.id) === menuItemId);
      if (!menuItem) return;

      const modifiers = await getModifierGroupsForMenuItem(menuItemId);
      const selectedModifiers = targetItem.modifiers.map((modifier) => ({
        modifier_id: toInt(modifier.modifier_id),
        modifier_name: modifier.modifier_name,
        modifier_group_name: modifier.modifier_group_name,
        extra_price: modifier.extra_price,
      }));
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

  return {
    showModifierPicker,
    selectedMenuItem,
    menuItemModifiers,
    editingItemModifiers,
    editingItemNotes,
    editingItemWeight,
    isEditing: editingOrderItemId !== null || editingCartItemId !== null,
    handleMenuItemPress,
    handleModifierConfirm,
    handleEditModifiers,
    handleCancel: reset,
  };
}
