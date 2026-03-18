# POS Tempest - Codebase Simplification Plan

## Context

The codebase has significant code duplication, especially between the two order screens (`takeaway.tsx` and `[tableId].tsx`) which share ~70% identical code. There are also inline type coercion patterns, repeated button styling patterns, duplicated payment configs, and scattered date formatting.

**Goal:** Remove ~1,400 lines through 6 incremental phases while improving maintainability.

---

## Progress

| Phase | Status |
|-------|--------|
| 1 — `toInt()` utility | ✅ Done |
| 2 — Modifier picker hook | ✅ Done |
| 3 — Order screen consolidation | ✅ Done |
| 4 — Payment method config | ✅ Done |
| 5 — Date formatting utils | ✅ Done |
| 6 — Pressable style helper (optional) | ⬜ Pending |

---

## Dependency Graph

```
Phase 1 (toInt utility) ──┐
                          ├──> Phase 3 (order screen consolidation)
Phase 2 (modifier hook) ──┘

Phase 4, 5, 6 — fully independent, can run in any order or in parallel
```

---

## Phase 1: `toInt()` Utility ✅

**Status:** Complete

Created `utils/coerce.ts` with `toInt()` and `toIntOrNull()`. Replaced 78+ inline coercions across 18 files.

---

## Phase 2: Extract Modifier Picker State Into a Custom Hook ✅

**Status:** Complete

Created `hooks/use-modifier-picker.ts`. Removed 8 duplicated state variables and 3 identical handlers from both order screens.

**Hook interface:**
- Input: `{ cartItems, orderItems, menuItems, getModifierGroupsForMenuItem, addItemToOrder, updateCartItem, editModifiers, logTag? }`
- Returns: `{ showModifierPicker, selectedMenuItem, menuItemModifiers, editingItemModifiers, editingItemNotes, editingItemWeight, isEditing, handleMenuItemPress, handleModifierConfirm, handleEditModifiers, handleCancel }`

---

## Phase 3: Consolidate Order Screens Into Shared Hook

**Status:** Complete
**Complexity:** Large | **Risk:** Medium | **Est. Lines Saved:** ~1,000
**Depends on:** Phase 1 + Phase 2 (both done)

### Problem

`takeaway.tsx` (~600 lines) and `[tableId].tsx` (~650 lines) share ~70% identical code:
- Category selection state + effects
- Customer assignment state + handlers
- All `useMemo` computations (`subCategories`, `allMenuItems`, `menuItemsList`, `categoryById`, `menuCategoryByItemId`, `topLevelCategoryById`, `topLevelBySubCategoryId`, `itemsForPanel`, `pendingRoundItemsDisplay`, `quantitiesByMenuItemId`, `allItemsForGrid`)
- Callback wrappers (`handleSelectCategory`, `handleSelectSubCategory`, `handleSendToKitchen`, `handlePayment`, `handleCancelOrder`, `handlePrintBill`, `handleMenuItemDecrement`)

### True Differences Between Screens

| Concern | `takeaway.tsx` | `[tableId].tsx` |
|---------|---------------|-----------------|
| Table data | None | `getOrderTableById` SQL query + `table` state |
| Guest count | `null` / no-op | `guestCount` + `handleGuestCountChange` |
| Order creation | Custom `handleConfirmOrder` with `isSubmitting` + `confirmOrderService` | Delegates to `useOrder`'s `confirmOrder` directly |
| Header JSX | `🛍 Takeaway` + order number | Table number + order number |

### Solution

**Create:** `hooks/use-order-screen.ts`

```ts
interface UseOrderScreenOptions {
  orderType: 'dine-in' | 'takeaway';
  tableId: number | null;
  orderId: number | null;
}
```

Internally calls `useMenu()`, `useOrder()`, `useShift()`, `useModifierPicker()` and exposes everything both screens need.

### Result

- `takeaway.tsx`: ~600 → **~80 lines** (thin wrapper: Takeaway header + confirm logic)
- `[tableId].tsx`: ~650 → **~100 lines** (thin wrapper: table query + table header)

### Files to Create/Modify

- **Create** `hooks/use-order-screen.ts`
- **Modify** `app/(app)/order/takeaway.tsx`
- **Modify** `app/(app)/order/[tableId].tsx`

### Verification

- Full order flow: takeaway + dine-in
- Category navigation, search, modifier editing, customer assignment
- Send to kitchen, payment, cancel order, print bill

---

## Phase 4: Payment Method Config Consolidation

**Status:** Pending
**Complexity:** Small | **Risk:** Low | **Est. Lines Saved:** ~20
**Independent:** Yes

### Problem

- `SplitPayment.tsx` defines `METHOD_LABELS` and `METHOD_COLORS` locally
- `PaymentMethodSelector.tsx` defines `PAYMENT_METHODS` array with the same data
- `PaymentColors` already exists in `constants/theme.ts`

### Solution

**Create** `constants/payment.ts` with a single `PAYMENT_METHODS` config array + derived lookup maps (`PAYMENT_METHOD_LABEL`, `PAYMENT_METHOD_COLOR`).

### Files to Create/Modify

- **Create** `constants/payment.ts`
- **Modify** `components/payment/PaymentMethodSelector.tsx`
- **Modify** `components/payment/SplitPayment.tsx`

---

## Phase 5: Date Formatting Utils

**Status:** Pending
**Complexity:** Small | **Risk:** Low | **Est. Lines Saved:** ~25
**Independent:** Yes

### Problem

- `RoundDivider.tsx` has inline `formatSentTime` (HH:mm format)
- `KOTCard.tsx` has inline `getElapsed` ("5m", "1h 30m")
- `utils/date.ts` only has `formatDate` and `toISOString`

### Solution

**Modify** `utils/date.ts` — add:
- `formatTime(date: Date | string): string` — HH:mm in Asia/Jakarta
- `formatElapsed(isoString: string): string` — relative time string

### Files to Modify

- `utils/date.ts`
- `components/order/RoundDivider.tsx`
- `components/kitchen/KOTCard.tsx`

---

## Phase 6: Pressable Style Helper (Optional)

**Status:** Pending
**Complexity:** Small | **Risk:** Low | **Est. Lines Saved:** ~15
**Independent:** Yes

### Problem

This pattern appears 18+ times across 5 files:
```ts
style={({ pressed }) => ({
  opacity: pressed ? 0.7 : 1,
  transform: [{ scale: pressed ? 0.98 : 1 }],
})}
```

### Solution

**Create** `utils/pressable-style.ts` with a `withPressedOpacity()` helper.

### Files to Create/Modify

- **Create** `utils/pressable-style.ts`
- `components/order/OrderActions.tsx`
- `components/payment/CashPayment.tsx`
- `components/payment/DiscountSelector.tsx`
- `components/payment/PaymentMethodSelector.tsx`
- `app/(app)/checkout/[orderId].tsx`

---

## Summary

| Phase | What | New Files | Files Modified | Lines Saved | Complexity | Risk |
|-------|------|-----------|----------------|-------------|------------|------|
| 1 ✅ | `toInt()` utility | 1 | 18 | ~150 | Small | Low |
| 2 ✅ | Modifier picker hook | 1 | 2 | ~200 | Medium | Low-Med |
| 3 | Order screen consolidation | 1 | 2 | ~1,000 | Large | Medium |
| 4 | Payment config | 1 | 2 | ~20 | Small | Low |
| 5 | Date formatting | 0 | 3 | ~25 | Small | Low |
| 6 | Pressable style (optional) | 1 | 5 | ~15 | Small | Low |
| **Total** | | **5** | **32** | **~1,400** | | |
