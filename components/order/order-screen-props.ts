import type { AssignedCustomer } from '@/components/order/CustomerPickerRow';
import type { OrderItemDisplay } from '@/components/order/types';
import type { Category, Order } from '@/db/models';
import type { MenuItemWithInventory } from '@/hooks/use-menu';

/** All data and callbacks shared by both tablet and phone order-screen layouts. */
export interface OrderScreenSharedProps {
  /** Display title for the order context (e.g. "Table 5", "🛍 Takeaway") */
  title: string;

  // ── Order panel ─────────────────────────────────────────────────────────────
  order: Order | null;
  itemsForPanel: OrderItemDisplay[];
  pendingRoundItemsDisplay: OrderItemDisplay[];
  guestCount: number | null;
  currentRound: number;
  roundSentAt: Map<number, string>;
  onGuestCountChange: (count: number) => void;
  onUpdateQuantity: (itemId: number | string, newQuantity: number) => void;
  onEditModifiers: (itemId: number | string) => void;
  onConfirmOrder: () => void;
  onRemoveItem: (itemId: number | string) => void;
  onSendToKitchen: (round: number) => void;
  onPayment: () => void;
  onCancelOrder: () => void;
  onConfirmRound: () => void;
  onCancelRound: () => void;
  onPrintBill: () => void;
  isShiftOpen: boolean;
  assignedCustomer: AssignedCustomer | null;
  onAssignCustomer: (customer: AssignedCustomer) => void;
  onClearCustomer: () => void;

  // ── Menu section ─────────────────────────────────────────────────────────────
  topLevelCategories: Category[];
  subCategories: Category[];
  selectedCategoryId: number | null;
  selectedSubCategoryId: number | null;
  onSelectCategory: (categoryId: number) => void;
  onSelectSubCategory: (subCategoryId: number | null) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  menuItemsList: MenuItemWithInventory[];
  allItemsForGrid: MenuItemWithInventory[];
  categoryById: Map<number, { name: string; button_color?: string | null }>;
  quantitiesByMenuItemId: Record<number, number>;
  onMenuItemPress: (item: MenuItemWithInventory) => void;
  onMenuItemDecrement: (item: MenuItemWithInventory) => void;
}
