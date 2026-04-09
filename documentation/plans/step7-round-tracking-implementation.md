# Step 7 Round Tracking Implementation Plan

## Overview

This plan covers the implementation of the **Order Round Tracking** feature, which is the main missing piece from Step 7. This feature allows orders to have multiple rounds of items, with each round generating its own Kitchen Order Ticket (KOT).

## Key Concepts

### Order Rounds
- **Round 1**: Initial items added when order is first confirmed
- **Round 2, 3, etc.**: Additional items added after the order is already confirmed
- Each round is visually separated with a divider: `── Round 2 ──`
- Each round generates its own KOT when sent to kitchen
- All rounds share the same `order_id` but have different `round_number` values

### Three Order States
1. **Draft State**: Items held in local state, "Confirm Order" button shown
2. **Confirmed State**: Order saved to DB, "Send to Kitchen", "Print Bill", "Add Items", "Payment" buttons
3. **Pending Round State**: New items added after confirmation, "Confirm Round" / "Cancel Round" buttons, PENDING badges

---

## Implementation Tasks

### 1. Database Schema Updates

#### File: `db/schema.ts`

Add `round_number` column to `order_items` table:
```typescript
order_items: new Table({
  // ... existing columns
  round_number: column.integer,  // Which round the item belongs to (1, 2, 3, etc.)
}),
```

Add `round_number` column to `kitchen_order_tickets` table:
```typescript
kitchen_order_tickets: new Table({
  // ... existing columns
  round_number: column.integer,  // Which round this KOT is for
}),
```

#### File: `db/models/index.ts`

Update `OrderItem` interface:
```typescript
export interface OrderItem {
  // ... existing fields
  round_number: number;  // Default: 1
}
```

Update `KitchenOrderTicket` interface:
```typescript
export interface KitchenOrderTicket {
  // ... existing fields
  round_number: number;  // Default: 1
}
```

---

### 2. New Component: RoundDivider

#### File: `components/order/RoundDivider.tsx`

A simple visual divider component to separate rounds in the order items list.

```typescript
interface RoundDividerProps {
  roundNumber: number;
  sentAt?: string | null;  // Timestamp when this round was sent to kitchen
}

export function RoundDivider({ roundNumber, sentAt }: RoundDividerProps) {
  return (
    <View className="my-2 flex-row items-center">
      <View className="h-px flex-1 bg-border" />
      <View className="mx-3 items-center">
        <Text className="text-pos-xs font-semibold text-pos-text-muted">
          Round {roundNumber}
        </Text>
        {sentAt && (
          <Text className="text-pos-xs text-pos-text-faint">
            Sent {sentAt}
          </Text>
        )}
      </View>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
```

---

### 3. Update OrderActions Component

#### File: `components/order/OrderActions.tsx`

Implement three-state button system:

```typescript
interface OrderActionsProps {
  orderStatus: OrderStatus;
  hasItems: boolean;
  hasPendingRound: boolean;  // NEW: Are there unconfirmed round items?
  sentAt?: string | null;
  onSendToKitchen: () => void;
  onHold: () => void;
  onPayment: () => void;
  onConfirmRound: () => void;   // NEW
  onCancelRound: () => void;    // NEW
  onAddItems: () => void;       // NEW
}
```

**Button States:**

| State | Buttons Shown |
|-------|---------------|
| Draft | "Confirm Order" (in OrderPanel header) |
| Confirmed (no pending) | "Send to Kitchen", "Print Bill", "Add Items", "Payment" |
| Pending Round | "Confirm Round" (primary), "Cancel Round", "Print Bill" |

---

### 5. Update OrderPanel Component

#### File: `components/order/OrderPanel.tsx`

- Add `pendingRoundItems` prop
- Add `currentRound` prop
- Add `roundSentAt` map prop (round number → sent timestamp)
- Render `RoundDivider` between rounds
- Show PENDING badge on pending round items
- Pass new props to `OrderActions`

---

### 6. Update Order Service

#### File: `services/order.service.ts`

Add round-aware functions:

```typescript
/**
 * Adds an item to an order with a specific round number
 */
export async function addItemToOrder(
  orderId: number,
  menuItem: MenuItem,
  quantity: number,
  modifiers: SelectedModifier[],
  notes: string | null = null,
  weight: number | null = null,
  roundNumber: number = 1  // NEW parameter
): Promise<void>

/**
 * Gets the current round number for an order
 * Returns max(round_number) from order_items + 1, or 1 if no items
 */
export async function getCurrentRound(orderId: number): Promise<number>

/**
 * Confirms a round of pending items
 * Updates all pending items to have the confirmed round_number
 */
export async function confirmRound(
  orderId: number,
  roundNumber: number
): Promise<void>

/**
 * Cancels all items in a pending round
 * Removes all items with is_pending = true
 */
export async function cancelPendingRound(orderId: number): Promise<void>

/**
 * Gets items grouped by round
 */
export async function getOrderItemsByRound(orderId: number): Promise<Map<number, OrderItem[]>>
```

---

### 7. Create use-order Hook

#### File: `hooks/use-order.ts`

Encapsulate all order logic into a reusable hook:

```typescript
interface UseOrderOptions {
  tableId: number | null;
  orderId?: number | null;
}

interface UseOrderReturn {
  // State
  order: Order | null;
  items: OrderItemWithModifiers[];
  pendingRoundItems: OrderItemWithModifiers[];  // Items not yet confirmed
  isLoading: boolean;
  totals: OrderTotals;
  currentRound: number;      // 1, 2, 3, etc.
  isDraft: boolean;          // True if order not yet created in database
  hasPendingRound: boolean;  // True if there are unconfirmed round items
  roundSentAt: Map<number, string>;  // Round number → sent timestamp
  
  // Actions
  addItem: (item, qty, modifiers, notes, weight) => Promise<void>,
  updateQuantity: (itemId, qty) => Promise<void>,
  removeItem: (itemId) => Promise<void>,
  updateNotes: (itemId, notes) => Promise<void>,
  
  // Order lifecycle
  confirmOrder: () => Promise<void>,   // Creates order in DB, saves Round 1 items
  confirmRound: () => Promise<void>,   // Saves pending round items to DB
  cancelRound: () => void,             // Clears pending round items
  
  // Kitchen & Payment
  sendToKitchen: () => Promise<void>,  // Creates KOT for current round
  printBill: () => Promise<void>,      // Prints unpaid receipt
  goToPayment: () => void,             // Navigates to checkout
  
  // Refresh
  reload: () => Promise<void>,
}

export function useOrder(options: UseOrderOptions): UseOrderReturn
```

---

### 8. Update Order Screen

#### File: `app/(app)/order/[tableId].tsx`

Replace inline order logic with `useOrder` hook:

```typescript
export default function OrderScreen() {
  const { tableId } = useLocalSearchParams();
  
  const {
    order,
    items,
    pendingRoundItems,
    isLoading,
    totals,
    currentRound,
    isDraft,
    hasPendingRound,
    roundSentAt,
    addItem,
    updateQuantity,
    removeItem,
    confirmOrder,
    confirmRound,
    cancelRound,
    sendToKitchen,
    goToPayment,
  } = useOrder({ tableId: parseInt(tableId, 10) });
  
  // ... rest of component
}
```

---

## Implementation Order

1. **Database Schema** - Add `round_number` columns
2. **Models** - Update TypeScript interfaces
3. **RoundDivider** - Create new component
4. **OrderActions** - Implement three-state buttons
5. **Order Service** - Add round-aware functions
6. **use-order Hook** - Create new hook
7. **OrderPanel** - Update to handle rounds
8. **Order Screen** - Integrate hook and round tracking

---

## Verification Checklist

After implementation, verify:

- [ ] Draft state shows "Confirm Order" button
- [ ] Confirming order creates order in DB with order number
- [ ] Table turns occupied after order confirmed
- [ ] Confirmed state shows "Send to Kitchen", "Print Bill", "Add Items", "Payment"
- [ ] Adding items after confirmation creates pending round items
- [ ] "Confirm Round" / "Cancel Round" buttons appear when pending items exist
- [ ] Confirming round saves items with correct round_number
- [ ] Round dividers appear between confirmed rounds
- [ ] Each round can be sent to kitchen separately
- [ ] All data persists to SQLite and syncs to Supabase

---

## Files to Modify

| File | Action |
|------|--------|
| `db/schema.ts` | Add `round_number` columns |
| `db/models/index.ts` | Update interfaces |
| `components/order/RoundDivider.tsx` | Create new |
| `components/order/OrderActions.tsx` | Three-state buttons |
| `components/order/OrderPanel.tsx` | Round tracking UI |
| `services/order.service.ts` | Round-aware functions |
| `hooks/use-order.ts` | Create new hook |
| `app/(app)/order/[tableId].tsx` | Integrate hook |
| `app/(app)/order/takeaway.tsx` | Integrate hook (optional, same pattern) |
