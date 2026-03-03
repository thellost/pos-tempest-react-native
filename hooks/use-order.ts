import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { CartItem } from '@/components/order/types';
import { generateLocalId } from '@/components/order/types';
import { ORDER_STATUS, ORDER_TYPE } from '@/constants/enums';
import type { MenuItem, Order, OrderItem, OrderItemModifier } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import type { KOTWithItems } from '@/services/kitchen.service';
import { createKOT } from '@/services/kitchen.service';
import type { SelectedModifier } from '@/services/order.service';
import {
  addItemToOrder,
  confirmOrder as confirmOrderService,
  createOrder,
  getOrderWithItems,
  getRoundSentTimestamps,
  removeItemFromOrder,
  updateItemModifiers,
  updateItemNotes,
  updateItemQuantity,
  updateItemUnitPrice,
  voidOrder,
} from '@/services/order.service';
import type { BillData } from '@/services/receipt.service';
import { getBillData } from '@/services/receipt.service';

interface UseOrderOptions {
  tableId: number | null;
  orderId?: number | null;
  orderType?: 'dine-in' | 'takeaway';
  menuItems?: MenuItemWithInventory[];
  /** When false, adding items and confirming orders is blocked */
  isShiftOpen?: boolean;
}

interface OrderItemWithModifiers extends OrderItem {
  modifiers: OrderItemModifier[];
}

interface UseOrderReturn {
  // State
  order: Order | null;
  orderItems: OrderItemWithModifiers[];
  cartItems: CartItem[];
  pendingRoundItems: CartItem[];
  isLoading: boolean;
  currentRound: number;
  isDraft: boolean;
  hasPendingRound: boolean;
  roundSentAt: Map<number, string>;
  guestCount: number;

  // Item actions
  addItemToOrder: (item: MenuItemWithInventory, modifiers: SelectedModifier[], weight: number | null, notes: string) => Promise<void>;
  updateQuantity: (itemId: number | string, qty: number) => Promise<void>;
  removeItem: (itemId: number | string) => Promise<void>;
  updateNotes: (itemId: number, notes: string) => Promise<void>;
  editModifiers: (itemId: number | string, modifiers: SelectedModifier[], weight: number | null, notes: string, unitPrice?: number) => Promise<void>;

  // Order lifecycle
  confirmOrder: () => Promise<void>;
  cancelOrder: (reason?: string) => Promise<void>;
  confirmRound: () => Promise<void>;
  cancelRound: () => void;

  // Kitchen
  sendToKitchen: (roundNumber?: number) => Promise<void>;
  lastKOT: KOTWithItems | null;
  dismissKOT: () => void;

  // Bill preview
  printBill: () => Promise<void>;
  lastBill: BillData | null;
  dismissBill: () => void;
  goToPayment: () => void;

  // Guest count
  setGuestCount: (count: number) => void;

  // Cart item management (for modifier picker)
  updateCartItem: (cartItemId: string, updates: Partial<CartItem>) => void;
  removeCartItem: (cartItemId: string) => void;

  // Pending round item management
  updatePendingRoundItem: (itemId: string, updates: Partial<CartItem>) => void;
  removePendingRoundItem: (itemId: string) => void;

  // Refresh
  reload: () => Promise<void>;

  // Set order directly (for loading existing orders)
  setOrder: (order: Order | null) => void;
  setOrderItems: (items: OrderItemWithModifiers[]) => void;

  // Shift state (passed in from screen)
  isShiftOpen: boolean;
}

/**
 * Converts a MenuItemWithInventory to a MenuItem for DB operations.
 */
function toMenuItem(item: MenuItemWithInventory): MenuItem {
  return {
    id: item.id,
    category_id: item.category_id,
    name: item.name,
    description: item.description,
    sku: item.sku,
    barcode: item.barcode,
    image_url: item.image_url,
    pricing_type: item.pricing_type,
    unit_of_measure: item.unit_of_measure,
    price: item.price,
    cost: item.cost,
    min_order_qty: item.min_order_qty,
    preparation_time_minutes: item.preparation_time_minutes,
    is_available: item.is_available,
    is_active: item.is_active,
    sort_order: item.sort_order,
    created_at: '',
    updated_at: '',
  };
}

/**
 * Hook for managing order state with round tracking support.
 * Handles draft → confirmed → pending round flow.
 */
export function useOrder(options: UseOrderOptions): UseOrderReturn {
  const { tableId, orderId, orderType = 'dine-in', menuItems = [], isShiftOpen = true } = options;
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithModifiers[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pendingRoundItems, setPendingRoundItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [guestCount, setGuestCount] = useState(0);
  const [roundSentAt, setRoundSentAt] = useState<Map<number, string>>(new Map());
  const [lastKOT, setLastKOT] = useState<KOTWithItems | null>(null);
  const [lastBill, setLastBill] = useState<BillData | null>(null);

  const lastLoadedOrderIdRef = useRef<number | null | undefined>(undefined);

  // Calculate current round from order items
  const currentRound = useMemo(() => {
    if (order) {
      const maxRound = orderItems.reduce((max, item) => {
        const round = item.round_number || 1;
        return Math.max(max, round);
      }, 0);
      return Math.max(maxRound, 1);
    }
    return 1;
  }, [order, orderItems]);

  // Is this a draft order (not yet saved to DB)?
  const isDraft = !order;

  // Are there pending round items?
  const hasPendingRound = pendingRoundItems.length > 0;

  // Load order data on mount if orderId provided
  useEffect(() => {
    if (lastLoadedOrderIdRef.current === orderId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        if (orderId) {
          const orderData = await getOrderWithItems(orderId);
          if (orderData) {
            setOrder(orderData.order);
            setOrderItems(orderData.items as OrderItemWithModifiers[]);
            setGuestCount(orderData.order.guest_count || 0);

            const sentMap = await getRoundSentTimestamps(orderId);
            setRoundSentAt(sentMap);
          }
        }
        lastLoadedOrderIdRef.current = orderId;
      } catch (error) {
        console.error('[useOrder] Error loading order:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [orderId]);

  // Reload order from database
  const currentOrderId = order ? (typeof order.id === 'string' ? parseInt(order.id, 10) : order.id) : null;

  const reload = useCallback(async () => {
    if (currentOrderId === null) return;

    try {
      const orderData = await getOrderWithItems(currentOrderId);
      if (orderData) {
        setOrder(orderData.order);
        setOrderItems(orderData.items as OrderItemWithModifiers[]);

        const sentMap = await getRoundSentTimestamps(currentOrderId);
        setRoundSentAt(sentMap);
      }
    } catch (error) {
      console.error('[useOrder] Error reloading order:', error);
    }
  }, [currentOrderId]);

  // Add item to order - handles draft, confirmed, and pending round states
  const addItemToOrderHandler = useCallback(async (
    item: MenuItemWithInventory,
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string
  ) => {
    if (!user) return;
    if (!isShiftOpen) return; // Blocked by UI overlay; this is a defence layer

    const modifierTotal = modifiers.reduce((sum, m) => sum + m.extra_price, 0);
    const basePrice = weight ? item.price * weight : item.price;
    const total = basePrice + modifierTotal;

    if (order) {
      // If order is confirmed/preparing, add to pending round items
      if (order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.PREPARING) {
        const newPendingItem: CartItem = {
          id: generateLocalId(),
          menu_item_id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
          menu_item_name: item.name,
          quantity: 1,
          unit_price: basePrice,
          modifier_total: modifierTotal,
          total,
          notes: notes || null,
          modifiers,
          weight,
          round_number: currentRound + 1,
        };
        setPendingRoundItems(prev => [...prev, newPendingItem]);
      } else {
        // Order exists but not confirmed yet - add directly to DB
        try {
          const orderIdNum = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
          const menuItem: MenuItem = {
            id: item.id,
            category_id: item.category_id,
            name: item.name,
            description: item.description,
            sku: item.sku,
            barcode: item.barcode,
            image_url: item.image_url,
            pricing_type: item.pricing_type,
            unit_of_measure: item.unit_of_measure,
            price: item.price,
            cost: item.cost,
            min_order_qty: item.min_order_qty,
            preparation_time_minutes: item.preparation_time_minutes,
            is_available: item.is_available,
            is_active: item.is_active,
            sort_order: item.sort_order,
            created_at: '',
            updated_at: '',
          };
          await addItemToOrder(orderIdNum, menuItem, 1, modifiers, notes, weight);
          await reload();
        } catch (error) {
          console.error('[useOrder] Error adding item to order:', error);
        }
      }
    } else {
      // No order yet - add to cart items (draft state)
      const newCartItem: CartItem = {
        id: generateLocalId(),
        menu_item_id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
        menu_item_name: item.name,
        quantity: 1,
        unit_price: basePrice,
        modifier_total: modifierTotal,
        total,
        notes: notes || null,
        modifiers,
        weight,
        round_number: 1,
      };
      setCartItems(prev => [...prev, newCartItem]);
    }
  }, [order, user, currentRound, reload, isShiftOpen]);

  // Update item quantity
  const updateQuantity = useCallback(async (itemId: number | string, qty: number) => {
    // Check if it's a cart item (string ID)
    if (typeof itemId === 'string') {
      // Check cart items first
      const cartItem = cartItems.find(item => item.id === itemId);
      if (cartItem) {
        if (qty <= 0) {
          setCartItems(prev => prev.filter(item => item.id !== itemId));
        } else {
          setCartItems(prev =>
            prev.map(item => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                quantity: qty,
                total: (item.unit_price + item.modifier_total) * qty,
              };
            })
          );
        }
        return;
      }

      // Check pending round items
      const pendingItem = pendingRoundItems.find(item => item.id === itemId);
      if (pendingItem) {
        if (qty <= 0) {
          setPendingRoundItems(prev => prev.filter(item => item.id !== itemId));
        } else {
          setPendingRoundItems(prev =>
            prev.map(item => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                quantity: qty,
                total: (item.unit_price + item.modifier_total) * qty,
              };
            })
          );
        }
        return;
      }
      // String ID not found in local state — do not fall through to DB
      return;
    }

    // It's an order item (number ID)
    try {
      await updateItemQuantity(itemId as number, qty);
      await reload();
    } catch (error) {
      console.error('[useOrder] Error updating quantity:', error);
    }
  }, [cartItems, pendingRoundItems, reload]);

  // Remove item
  const removeItem = useCallback(async (itemId: number | string) => {
    if (typeof itemId === 'string') {
      // Check cart items first
      if (cartItems.some(item => item.id === itemId)) {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
        return;
      }
      // Check pending round items
      if (pendingRoundItems.some(item => item.id === itemId)) {
        setPendingRoundItems(prev => prev.filter(item => item.id !== itemId));
        return;
      }
      // String ID not found in local state — do not fall through to DB
      return;
    }

    // It's an order item
    try {
      await removeItemFromOrder(itemId as number);
      await reload();
    } catch (error) {
      console.error('[useOrder] Error removing item:', error);
    }
  }, [cartItems, pendingRoundItems, reload]);

  // Update item notes
  const updateNotes = useCallback(async (itemId: number, notes: string) => {
    try {
      await updateItemNotes(itemId, notes);
      await reload();
    } catch (error) {
      console.error('[useOrder] Error updating notes:', error);
    }
  }, [reload]);

  // Edit modifiers
  const editModifiers = useCallback(async (
    itemId: number | string,
    modifiers: SelectedModifier[],
    weight: number | null,
    notes: string,
    unitPrice?: number
  ) => {
    if (typeof itemId === 'string') {
      const modifierTotal = modifiers.reduce((sum, m) => sum + m.extra_price, 0);

      // Check cart items
      const cartItem = cartItems.find(item => item.id === itemId);
      if (cartItem) {
        setCartItems(prev =>
          prev.map(item => {
            if (item.id !== itemId) return item;
            const basePrice = weight && item.unit_price > 0
              ? (item.unit_price / (item.weight || 1)) * weight
              : item.unit_price;
            return {
              ...item,
              modifiers,
              notes: notes || null,
              weight,
              unit_price: basePrice,
              modifier_total: modifierTotal,
              total: (basePrice + modifierTotal) * item.quantity,
            };
          })
        );
        return;
      }

      // Check pending round items
      const pendingItem = pendingRoundItems.find(item => item.id === itemId);
      if (pendingItem) {
        setPendingRoundItems(prev =>
          prev.map(item => {
            if (item.id !== itemId) return item;
            const basePrice = weight && item.unit_price > 0
              ? (item.unit_price / (item.weight || 1)) * weight
              : item.unit_price;
            return {
              ...item,
              modifiers,
              notes: notes || null,
              weight,
              unit_price: basePrice,
              modifier_total: modifierTotal,
              total: (basePrice + modifierTotal) * item.quantity,
            };
          })
        );
        return;
      }
      // String ID not found in local state — do not fall through to DB
      return;
    }

    // It's an order item
    try {
      await updateItemModifiers(itemId as number, modifiers);
      if (unitPrice !== undefined) {
        await updateItemUnitPrice(itemId as number, unitPrice);
      }
      await updateItemNotes(itemId as number, notes);
      // Note: weight/unit price update would need the menu item price
      await reload();
    } catch (error) {
      console.error('[useOrder] Error editing modifiers:', error);
    }
  }, [cartItems, pendingRoundItems, reload]);

  // Confirm order (draft → confirmed)
  const confirmOrderCallback = useCallback(async () => {
    if (!user || cartItems.length === 0) return;

    if (!isShiftOpen) {
      Alert.alert('No Active Shift', 'Please open a shift before confirming orders.');
      return;
    }

    try {
      const newOrder = await createOrder(
        user.branch_id,
        tableId,
        user.id,
        null,
        orderType === 'takeaway' ? ORDER_TYPE.TAKEAWAY : ORDER_TYPE.DINE_IN,
        guestCount || 0
      );

      const orderIdNum = typeof newOrder.id === 'string' ? parseInt(newOrder.id, 10) : newOrder.id;

      const orderFailures: string[] = [];
      for (const cartItem of cartItems) {
        const menuItem = menuItems.find(m => {
          const mId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
          return mId === cartItem.menu_item_id;
        });

        if (!menuItem) {
          orderFailures.push(cartItem.menu_item_name);
          continue;
        }
        await addItemToOrder(orderIdNum, toMenuItem(menuItem), cartItem.quantity, cartItem.modifiers, cartItem.notes, cartItem.weight);
      }
      if (orderFailures.length > 0) {
        throw new Error(`Menu items not found: ${orderFailures.join(', ')}`);
      }

      await confirmOrderService(orderIdNum);

      const orderData = await getOrderWithItems(orderIdNum);
      if (orderData) {
        setOrder(orderData.order);
        setOrderItems(orderData.items as OrderItemWithModifiers[]);
      }
      setCartItems([]);
    } catch (error) {
      console.error('[useOrder] Error confirming order:', error);
      throw error;
    }
  }, [user, cartItems, tableId, orderType, guestCount, menuItems, isShiftOpen]);

  // Confirm round (pending → confirmed)
  const confirmRound = useCallback(async () => {
    if (!order || pendingRoundItems.length === 0) return;

    if (!isShiftOpen) {
      Alert.alert('No Active Shift', 'Please open a shift before adding new rounds.');
      return;
    }

    try {
      const orderIdNum = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
      const newRound = currentRound + 1;

      const roundFailures: string[] = [];
      for (const cartItem of pendingRoundItems) {
        const menuItem = menuItems.find(m => {
          const mId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
          return mId === cartItem.menu_item_id;
        });

        if (!menuItem) {
          roundFailures.push(cartItem.menu_item_name);
          continue;
        }
        await addItemToOrder(orderIdNum, toMenuItem(menuItem), cartItem.quantity, cartItem.modifiers, cartItem.notes, cartItem.weight, newRound);
      }
      if (roundFailures.length > 0) {
        throw new Error(`Menu items not found: ${roundFailures.join(', ')}`);
      }

      setPendingRoundItems([]);
      await reload();
    } catch (error) {
      console.error('[useOrder] Error confirming round:', error);
      throw error;
    }
  }, [order, pendingRoundItems, currentRound, menuItems, reload, isShiftOpen]);

  // Cancel order (soft cancel only, never deletes)
  const cancelOrder = useCallback(async (reason = 'Cancelled from POS') => {
    if (!order || !user) {
      Alert.alert('Cancel Order', 'No active order to cancel.');
      return;
    }

    if (!isShiftOpen) {
      Alert.alert('No Active Shift', 'Please open a shift before cancelling orders.');
      return;
    }

    try {
      const orderIdNum = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
      await voidOrder(orderIdNum, user.id, reason);

      // Clear current order state from UI after cancel
      setOrder(null);
      setOrderItems([]);
      setPendingRoundItems([]);
      setCartItems([]);
      setRoundSentAt(new Map());
      setGuestCount(0);
      setLastKOT(null);
      setLastBill(null);
    } catch (error) {
      console.error('[useOrder] Error cancelling order:', error);
      throw error;
    }
  }, [order, user, isShiftOpen]);

  // Cancel round (clear pending items)
  const cancelRound = useCallback(() => {
    setPendingRoundItems([]);
  }, []);

  // Send to kitchen — creates KOT for the given round (defaults to current round).
  // Reprinting the same round is allowed; each call creates a new KOT record.
  const sendToKitchen = useCallback(async (roundNumber?: number) => {
    if (!order) {
      Alert.alert('Error', 'No active order to send to kitchen.');
      return;
    }

    const roundToPrint = roundNumber ?? currentRound;
    const orderIdNum =
      typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;

    try {
      const kot = await createKOT(orderIdNum, roundToPrint);

      setRoundSentAt((prev) => {
        const next = new Map(prev);
        next.set(roundToPrint, kot.created_at);
        return next;
      });

      setLastKOT(kot);

      await reload();
    } catch (error) {
      console.error('[useOrder] Error sending to kitchen:', error);
      Alert.alert(
        'Kitchen Error',
        error instanceof Error ? error.message : 'Failed to send to kitchen.'
      );
    }
  }, [order, currentRound, reload]);

  // Dismiss KOT preview modal
  const dismissKOT = useCallback(() => {
    setLastKOT(null);
  }, []);

  // Print bill — fetches order data and surfaces a preview via lastBill
  const printBill = useCallback(async () => {
    if (!order) {
      Alert.alert('Error', 'No active order to print.');
      return;
    }
    try {
      const orderIdNum =
        typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
      const bill = await getBillData(orderIdNum, false);
      setLastBill(bill);
    } catch (error) {
      console.error('[useOrder] Error generating bill:', error);
      Alert.alert(
        'Print Error',
        error instanceof Error ? error.message : 'Failed to generate bill.',
      );
    }
  }, [order]);

  // Dismiss bill preview modal
  const dismissBill = useCallback(() => {
    setLastBill(null);
  }, []);

  // Go to payment
  const goToPayment = useCallback(() => {
    if (!order) return;
    const orderIdNum = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
    router.push({ pathname: '/(app)/checkout/[orderId]', params: { orderId: String(orderIdNum) } });
  }, [order, router]);

  // Cart item management (for modifier picker)
  const updateCartItem = useCallback((cartItemId: string, updates: Partial<CartItem>) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.id !== cartItemId) return item;
        return { ...item, ...updates };
      })
    );
  }, []);

  const removeCartItem = useCallback((cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== cartItemId));
  }, []);

  // Pending round item management
  const updatePendingRoundItem = useCallback((itemId: string, updates: Partial<CartItem>) => {
    setPendingRoundItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        return { ...item, ...updates };
      })
    );
  }, []);

  const removePendingRoundItem = useCallback((itemId: string) => {
    setPendingRoundItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  return {
    order,
    orderItems,
    cartItems,
    pendingRoundItems,
    isLoading,
    currentRound,
    isDraft,
    hasPendingRound,
    roundSentAt,
    guestCount,

    addItemToOrder: addItemToOrderHandler,
    updateQuantity,
    removeItem,
    updateNotes,
    editModifiers,

    confirmOrder: confirmOrderCallback,
    cancelOrder,
    confirmRound,
    cancelRound,

    sendToKitchen,
    lastKOT,
    dismissKOT,
    printBill,
    lastBill,
    dismissBill,
    goToPayment,

    setGuestCount,
    updateCartItem,
    removeCartItem,
    updatePendingRoundItem,
    removePendingRoundItem,

    reload,
    setOrder,
    setOrderItems,
    isShiftOpen,
  };
}
