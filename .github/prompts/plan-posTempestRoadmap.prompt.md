## Plan: POS Tempest — Restaurant POS Development

**TL;DR:** Build an offline-first restaurant POS app on Android tablets using Expo + PowerSync + SQLite + Supabase + NativeWind. The app supports open tables/bills, kitchen & cashier Bluetooth thermal printing, PIN-based quick auth, and is structured for long-term maintainability. 13 steps, executed sequentially.

Shifts and cash drawers are scoped to **devices** (terminals), not users — ensuring physical cash accountability.

The UI will follow a **Toast POS-inspired** aesthetic: dark theme, large touch targets, grid-based menu, split-panel order view, minimal visual noise.

---

### Step 1 — Project Structure & NativeWind Setup

**Goal:** Replace the Expo boilerplate with a scalable folder structure and wire up NativeWind (Tailwind CSS for React Native).

Restructure the project to:

```
app/                        ← Expo Router screens only (thin)
  _layout.tsx               ← Root: providers wrapper
  (auth)/
    _layout.tsx
    login.tsx               ← Email/password login
    pin.tsx                 ← PIN quick-unlock
  (app)/
    _layout.tsx             ← Sidebar/drawer layout for main POS
    floor/index.tsx         ← Table map / floor view
    order/[tableId].tsx     ← Active order for a table
    menu/index.tsx          ← Menu catalog (admin/manager)
    kitchen/index.tsx       ← Kitchen Display System (KDS)
    checkout/[orderId].tsx  ← Payment screen
    settings/index.tsx      ← Branch & printer config
    shifts/index.tsx        ← Open/close shift
    inventory/index.tsx     ← Stock management
    customers/index.tsx     ← Customer lookup
    reports/index.tsx       ← Sales reports

db/
  schema.ts               ← PowerSync table definitions
  connector.ts            ← Supabase ↔ PowerSync connector
  provider.tsx            ← PowerSyncDatabase init + React provider
  migrations/             ← Future local schema migrations
models/                   ← TypeScript types mirroring ERD
  index.ts
  branch.ts, order.ts, menu-item.ts, ...
services/                 ← Business logic (pure functions, testable)
  order.service.ts
  payment.service.ts
  kitchen.service.ts
  inventory.service.ts
  shift.service.ts
  print.service.ts
hooks/                    ← React hooks (thin wrappers over services + db)
  use-auth.ts
  use-orders.ts
  use-menu.ts
  use-tables.ts
  use-printer.ts
  use-shift.ts
components/               ← Shared reusable UI
  ui/                     ← Primitives: Button, Card, Badge, Modal, NumPad
  order/                  ← OrderPanel, OrderItemRow, ModifierPicker
  menu/                   ← MenuGrid, MenuItemCard, CategoryTabs
  floor/                  ← TableCard, FloorAreaTabs
  kitchen/                ← KOTCard, KOTItemRow
  payment/                ← PaymentMethodSelector, SplitPayment, ChangeCalc
  print/                  ← ReceiptPreview
lib/
  supabase.ts             ← (existing, keep)
  powersync.ts            ← PowerSync instance export
  printer.ts              ← Bluetooth + ESC/POS abstraction
utils/
  currency.ts             ← IDR formatting helpers
  date.ts                 ← Timezone-aware date helpers (Asia/Jakarta)
  order-number.ts         ← ORD-YYYYMMDD-XXX generator
constants/
  theme.ts                ← Color constants & dark/light tokens, Toast POS palette
  global.css              ← Tailwind directives + custom dark theme CSS variables
  enums.ts                ← Mirrored enums from ERD
  config.ts               ← App-wide constants (timeouts, limits)
```

**Actions:**
- Remove all Expo boilerplate screens (`app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/modal.tsx`)
- Remove unused boilerplate components (`components/hello-wave.tsx`, `components/parallax-scroll-view.tsx`, etc.)
- Install & configure NativeWind v4 (`nativewind`, `tailwindcss`) with the Expo preset. Create `tailwind.config.ts` with a dark-first Toast POS-inspired theme extending Tailwind colors (slate-900 backgrounds, blue-500 primary, large spacing). Create `global.css` with `@tailwind` directives. Add `nativewind/babel` to `babel.config.js`. All components use `className` prop for styling
- Update `tsconfig.json` path aliases: `@/src/*` → `src/*`
- Set orientation to `landscape` in `app.json` config (remove the programmatic lock)

---

### Step 2 — PowerSync Schema & Data Layer

**Goal:** Define the local SQLite schema via PowerSync and create the Supabase connector so the app syncs offline-first.

**Actions:**
- Create `src/db/schema.ts` — define only the needed tables from the ERD as PowerSync `Table` definitions with correct column types. Map enums to `TEXT`, decimals to `REAL`, booleans to `INTEGER`, timestamps to `TEXT`. If a schema already exists, refactor it to match the new folder structure- Create `src/db/provider.tsx` — initialize `PowerSyncDatabase` with the schema, wrap app in `PowerSyncContext.Provider`
- Create `src/models/` — TypeScript interfaces for every table (strictly typed, matching ERD) , refer to the exisiting powersync.ts definition of the each tables
- Create `src/constants/enums.ts` — all 13 enum types as `const` objects with TypeScript literal types . refer to documentation POS-TEMPEST.SQL
- Update `app/_layout.tsx` to wrap the app in `<PowerSyncProvider>`

**Verification:** App boots, connects to PowerSync, syncs seed data to local SQLite. Verify with `usePowerSync()` hook + a test query.

---

### Step 3 — Auth & Session Management

**Goal:** Implement email login → Supabase session → PIN quick-unlock flow with protected routes.

**Actions:**
- Create `src/hooks/use-auth.ts` — manages auth state: `session`, `user` (from `users` table with role + branch), `isAuthenticated`, `signIn`, `signOut`, `unlockWithPin`
- Create `app/(auth)/_layout.tsx` — unauthenticated layout (centered card, dark background)
- Create `app/(auth)/login.tsx` — email/password form (refactor existing `components/Auth.tsx`). On success, store session and navigate to `(app)`
- Create `app/(auth)/pin.tsx` — 6-digit PIN pad screen. Shown when session exists but app was backgrounded/locked. Validates PIN against local `users` table (works offline)
- Create `app/(app)/_layout.tsx` — protected layout with auth guard: redirects to `(auth)` if no session. Contains the main sidebar/drawer navigation
- Wire up auto-lock: after configurable idle timeout, navigate to PIN screen
- Fetch `user` row from PowerSync on login (join `users` + `roles` to get role name, branch_id)

**Verification:** Login with email → land on floor view. Background app → return → PIN screen. Wrong PIN rejected. Correct PIN → back to POS.

---

### Step 4 — Device Registration & Management

**Goal:** Each physical POS terminal (tablet) gets a unique device identity tied to a branch. Shifts, orders, and cash drawers are scoped to the **device**, not just the user. When a different cashier logs in on the same device, the shift and money persist.

**Actions:**
- Create `src/lib/device.ts` — device identity utilities:
  - `getOrCreateDeviceId()` — generates a UUID on first launch and persists it in `AsyncStorage` under key `@pos_tempest/device_id`. Returns the same UUID on subsequent calls. Survives app restarts, lost only on reinstall or manual clear
  - `getDeviceInfo()` — returns `{ deviceId, deviceName, model, osVersion }` using `expo-device` + stored UUID
  - `clearDeviceId()` — for admin reset / re-registration
- Create `src/services/device.service.ts` — device registration business logic:
  - `registerDevice(deviceId, branchId, deviceName)` — inserts into `devices` table, marks as `active`
  - `getDeviceRegistration(deviceId)` — queries `devices` table by `device_uid` to get branch association + status
  - `isDeviceRegistered(deviceId)` — boolean check
  - `deactivateDevice(deviceId)` — sets status to `inactive` (admin only)
  - `updateDeviceName(deviceId, newName)` — rename a terminal (e.g. "Kasir 1", "Kasir 2")
- Create `src/hooks/use-device.ts` — provides `deviceId`, `deviceRegistration`, `isRegistered`, `registerDevice()` to the app
- Create device setup screen (shown on first launch or when device is unregistered):
  - Select branch from synced branches list
  - Enter device/terminal name (e.g. "Kasir 1", "Bar", "Drive-Thru")
  - Confirm registration → device row created, branch locked
- Add device guard in `app/(app)/_layout.tsx`: if device is not registered, redirect to device setup screen before any POS access
- Update `SessionMetadata` in `lib/security.ts` to populate the `deviceId` field from `getOrCreateDeviceId()`
- Admin device management: settings screen shows list of registered devices for the branch, allows rename/deactivate

**PowerSync schema addition:**
```
devices: {
  branch_id:     column.integer
  device_uid:    column.text       // UUID from AsyncStorage
  device_name:   column.text       // e.g. "Kasir 1"
  status:        column.text       // 'active' | 'inactive'
  registered_at: column.text
  last_seen_at:  column.text
}
```

**Verification:** First launch → device setup screen → select "Kemang" branch → name "Kasir 1" → registered. Kill app → relaunch → device recognized, skips setup. Admin can see device in settings.

---

### Step 5 — Shift Management (Device-Scoped)

**Goal:** Cashiers must open a shift before taking orders. Shifts are tied to the **device** (terminal), not the user. The cash drawer balance persists even when a different user logs in on the same device.

**Actions:**
- Create `src/services/shift.service.ts` — `openShift(userId, deviceId, branchId, openingCash)`, `closeShift(shiftId, closingCash)`, `getActiveShift(deviceId)` (note: lookup by device, not user)
- Create `src/hooks/use-shift.ts` — provides current active shift for **this device** to the app, checks if shift is open
- Create `app/(app)/shifts/index.tsx` — UI to open shift (enter opening cash amount via numpad), view current shift summary, close shift (enter closing cash, show expected vs actual, calculate difference). Shows which device this shift belongs to
- Add shift guard in `app/(app)/_layout.tsx`: if role is `cashier` and no open shift **on this device**, redirect to shift screen before allowing access to order/floor screens
- `openShift` records both `user_id` (who opened) and `device_id` (which terminal) — the shift stays open on the device even if the user logs out and someone else logs in
- `closeShift` records the `user_id` of whoever closes it (may differ from who opened)

**Key behavioral difference from user-scoped shifts:**
- User A opens shift on Kasir 1 with 500k → goes on break → User B logs in on Kasir 1 → User B can take orders under the **same shift** → User B closes shift → cash reconciliation reflects all transactions on Kasir 1
- User A logs into a **different** device (Kasir 2) → must open a separate shift there

**Verification:** Open shift with 500,000 IDR on device "Kasir 1" → shift saved locally → synced to Supabase. Log out → log in as different user on same device → same shift is active. Close shift → cash reconciliation shown.

---

### Step 6 — Floor & Table Management

**Goal:** Show a visual floor plan so staff can see table status and tap to open/manage orders.

**Actions:**
- Create `src/hooks/use-tables.ts` — queries `floor_areas` + `tables` for the current branch, joins with active `orders` to show occupied status and current bill total
- Create `src/components/floor/FloorAreaTabs.tsx` — horizontal tabs for floor areas (Indoor, Outdoor, VIP)
- Create `src/components/floor/TableCard.tsx` — card per table showing: table number, capacity, status (color-coded: green=available, red=occupied, yellow=reserved, gray=maintenance), guest count, current order total, elapsed time since order opened
- Create `app/(app)/floor/index.tsx` — grid of `TableCard` components, grouped by floor area via tabs. Tap available table → create new order → navigate to order screen. Tap occupied table → navigate to existing order
- Handle table status updates reactively via PowerSync live queries

**Verification:** See all Kemang tables across Indoor/Outdoor/VIP. Tap A3 → opens order screen. Table turns red. Other devices see the update after sync.

---

#### Step 6b — Takeaway Order Quick Access

**Goal:** Allow staff to create and manage takeaway orders directly from the floor plan without selecting a table.

**Actions:**
- Add "Takeaway" button in floor plan header (next to table stats)
  - Tap → creates new takeaway order → navigates to order screen
  - Visual: bag icon, distinct from table cards
- Add "Takeaway" tab in `FloorAreaTabs` component
  - Shows list of active takeaway orders (pending, confirmed, preparing)
  - Each item: order number, customer name (if assigned), total, elapsed time
  - Tap → resume existing takeaway order
- Create `app/(app)/order/takeaway.tsx` route
  - Same UI as table order screen but:
    - `order_type = 'takeaway'`
    - `table_id = null`
    - Header shows "Takeaway Order" + order number
    - Optional customer assignment at top
- Update `createOrder()` in `order.service.ts` to accept `tableId: number | null`
- Create `hooks/use-takeaway.ts` — query active takeaway orders reactively

**UI Reference:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Floor Plan                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ Available│ │ Occupied │ │ Reserved │ │  Total   │ │ Takeaway││
│  │    12    │ │     4    │ │     2    │ │    18    │ │   +    ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
├─────────────────────────────────────────────────────────────────┤
│ [Indoor] [Outdoor] [VIP] [Takeaway ←]                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ ORD-260223-A1B-001  │  │ ORD-260223-A1B-002  │               │
│  │ Rp 125.000          │  │ Rp 89.000           │               │
│  │ 12 mins ago         │  │ 5 mins ago          │               │
│  └─────────────────────┘  └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

**Verification:** Tap "Takeaway" button → new takeaway order created → order screen opens with takeaway type. Tap "Takeaway" tab → see list of active takeaway orders → tap to resume.

---

### Step 7 — Menu Display & Order Creation (Core POS)

**Goal:** The main order-taking screen — split panel with menu grid on the left and order summary on the right (Toast POS style). This step is broken into 6 sub-steps for manageability.

**Design Decisions (Toast POS Research):**
- **Theme:** Dark mode default (`#0B1220` background), orange accent (`#803500`)
- **Layout:** 65% menu grid / 35% order panel (landscape tablet)
- **Category colors:** Admin-configurable via `button_color` column on categories table
- **Modifier picker:** Full-screen modal (optimized for tablet landscape)
- **Weight input:** Manual entry via numpad (no scale integration)
- **Direct add:** Items with no modifiers add immediately on tap (no confirmation)

**Database Schema Change Required:**
```typescript
// Add to categories table in db/schema.ts
button_color: column.text  // Hex color e.g. "#803500", nullable

// Update Category interface in db/models/index.ts
button_color: string | null  // Null defaults to slate "#334155"
```

---

#### Step 7a — Category Navigation & Menu Grid

**Goal:** Build the left-side menu browsing interface with Toast-style navigation.

**Actions:**
- Create `components/menu/CategoryTabs.tsx`:
  - Horizontal scrollable tabs for top-level categories
  - Active state: orange accent border bottom, bold text
  - Sub-categories: secondary row of smaller pills beneath
  - Search icon → opens menu item search modal
  - Sticky positioning at top of menu area
- Create `components/menu/MenuGrid.tsx`:
  - 4-column responsive grid (adjusts to 3 on smaller screens)
  - Each cell: `min-h-pos-touch` (48px minimum)
  - Gap: 12px between items
  - Pull-to-refresh for sync status feedback
- Create `components/menu/MenuItemCard.tsx`:
  - Toast-style square button design
  - Background: category `button_color` or fallback `#334155`
  - Content: item name (truncated), price in IDR
  - Badges: "Weight" icon for weight-based, "Low Stock" indicator
  - Out-of-stock: grayed out with strikethrough
  - Press feedback: scale down + haptic

**Direct Add Logic:**
```typescript
const handleMenuItemPress = async (item: MenuItem) => {
  const hasModifiers = await hasModifierGroups(item.id);
  const isWeightBased = item.pricing_type === 'weight_based';
  
  if (!hasModifiers && !isWeightBased) {
    // Direct add - no confirmation
    await addItemToOrder(order.id, item, 1, [], null, null);
  } else {
    // Open full-screen modifier picker
    setSelectedItem(item);
    setShowModifierPicker(true);
  }
};
```

**Verification:** Categories scroll horizontally, grid shows 4 columns with category-colored backgrounds, items without modifiers add directly, items with modifiers open picker.

---

#### Step 7b — Order Panel (Right Sidebar)

**Goal:** Build the right-side order summary panel with Toast-style action buttons.

**Actions:**
- Create `components/order/OrderPanel.tsx`:
  - Fixed-width right panel (30-35% of screen)
  - Three sections: Header, Items List, Footer/Actions
- **Header Section:**
  - Table number (large, bold)
  - Order number (muted, small)
  - Guest count selector (stepper: - / count / +)
  - Dining option toggle: Dine-in | Takeaway
- **Items List:**
  - Scrollable list of `OrderItemRow` components
  - Empty state: "Tap menu items to add"
  - Sticky subtotal at bottom of list
- **Totals Section:**
  - Subtotal
  - Discount (if applied)
  - Tax (PPN 11%)
  - Service Charge (if configured)
  - Rounding
  - **Total (large, bold, orange accent)**
- **Action Buttons (bottom-fixed):**
  - "Send to Kitchen" (primary, orange)
  - "Hold" (secondary, outline)
  - "Payment" (secondary, outline)
  - Show "Sent HH:MM" timestamp after order sent (Toast pattern)
- **Confirmation Gate:**
  - Opening an order screen does not confirm the order
  - Order is confirmed only after cashier confirms it (this is when it should be cooked)
  - Hide "Hold" + "Send to Kitchen" until `ORDER_STATUS.CONFIRMED`
- Create `components/order/OrderTotals.tsx` — totals breakdown component
- Create `components/order/OrderActions.tsx` — action buttons component

**Verification:** Panel fixed on right, items scroll, totals update in real-time, buttons sticky at bottom.

---

#### Step 7c — Order Item Row & Quick Actions

**Goal:** Build the interactive order item row with swipe/edit/delete actions.

**Actions:**
- Create `components/order/OrderItemRow.tsx`:
  - Layout: `[qty badge] [name + modifiers] [price]`
  - Qty badge: circular, tap to increment (+1), long-press for numpad
  - Item name: bold, truncate with ellipsis
  - Modifiers: muted, smaller font, comma-separated horizontal
  - Price: right-aligned in IDR format
  - Swipe left → reveal red "Remove" button
  - Tap row → open QuickEditModal
  - Dense, receipt-like line items (compact per-item height)
  - Overall list feels spacious through category grouping
- Create `components/order/QuickEditModal.tsx`:
  - Full-screen modal (landscape tablet)
  - Qty stepper with + / - buttons
  - Notes input (optional, multiline)
  - "Update" / "Remove" buttons
  - For weight items: show weight display (read-only, set during add)
- Create `components/order/OrderItemBadge.tsx`:
  - Voided: red "VOID" badge
  - Sent to kitchen: green checkmark icon
  - Modifier changed: yellow dot indicator
- **Grouping:**
  - Group order items by top-level categories only (`parent_id IS NULL`)
  - Render category headers (e.g., "Makanan", "Minuman") with items listed underneath

**Verification:** Swipe reveals delete, tap opens edit modal, qty updates reflect immediately in totals, long-press opens numpad.

---

#### Step 7d — Modifier Picker (Full-Screen Modal)

**Goal:** Build the modifier selection interface when adding items with modifiers or weight.

**Actions:**
- Create `components/menu/ModifierPicker.tsx`:
  - **Full-screen modal** (optimized for tablet landscape, not bottom sheet)
  - **Header:** Item name, base price, close button
  - **Weight Input Section (if weight-based):**
    - Large weight display: "0.40 kg"
    - Numeric numpad (0-9, decimal, backspace)
    - Real-time price calculation: weight × unit price
  - **Modifier Groups:** Stacked vertically
    - Group header: name + required/optional badge
    - Required groups appear first
    - Horizontal scrollable buttons for options
    - Multi-select: checkboxes, respect `min_selections`, `max_selections`
    - Single-select: radio button behavior
    - Extra price shown: "+Rp5.000"
    - Selected state: orange border, checkmark icon
  - **Special Request Section:**
    - Text input: "e.g. No onions, extra sauce..."
    - Optional price field for admin-configured special requests
  - **Footer (sticky bottom):**
    - Running total: "Total: Rp45.000"
    - "Cancel" button (secondary)
    - "Add to Order" button (primary, orange) — disabled until required modifiers selected
- Create `components/menu/ModifierGroupRow.tsx`:
  - Reusable component for each modifier group
  - Validation state: shows error message if required group incomplete
  - Display ordering: respects `sort_order` from database
- Create `components/menu/WeightInput.tsx`:
  - Large numeric display
  - Full numpad layout
  - Min/max validation if configured on item
  - Decimal support (0.1, 0.25, 0.5, etc.)
  - Quick weight buttons: 0.25, 0.5, 1.0

**Layout Reference:**
```
┌────────────────────────────────────────────────────────┐
│  ←  Nasi Goreng Spesial                    Rp35.000   │
├────────────────────────────────────────────────────────┤
│  * SPICE LEVEL (Required)                              │
│  [ Original ] [ Pedas Sedang ✓ ] [ Extra Pedas ]      │
│                                                        │
│  ADD-ONS (Optional - Select up to 3)                   │
│  [ Telur Ceplok ✓ +5k ] [ Ayam Geprek +8k ] [...]    │
│                                                        │
│  SPECIAL REQUEST                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │ e.g. No onions, extra sauce...                 │   │
│  └────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────┤
│  Total: Rp45.000        [Cancel]  [Add to Order ✓]    │
└────────────────────────────────────────────────────────┘
```

**Verification:** Required groups enforce selection, total updates live, weight calculation correct, add to order creates item with all modifiers.

---

#### Step 7e — Order Service Layer (Business Logic)

**Goal:** Implement all order CRUD operations and calculations as pure, testable functions.

**Actions:**
- Create `services/order.service.ts`:
  ```typescript
  // Core CRUD operations
  createOrder(branchId, tableId, cashierId, shiftId, orderType, guestCount): Promise<Order>
  addItemToOrder(orderId, menuItem, quantity, modifiers[], notes, weight?): Promise<void>
  removeItemFromOrder(orderItemId): Promise<void>
  updateItemQuantity(orderItemId, newQuantity): Promise<void>
  updateItemNotes(orderItemId, notes): Promise<void>
  
  // Calculations
  calculateOrderTotals(orderId): Promise<OrderTotals>
  // Returns: { subtotal, discountAmount, taxAmount, serviceCharge, roundingAmount, total }
  
  // Void operations
  voidOrder(orderId, voidedBy, reason): Promise<void>
  voidItem(orderItemId, voidedBy, reason): Promise<void>
  
  // Retrieval
  getOrderWithItems(orderId): Promise<OrderWithItems | null>
  getActiveOrdersForTable(tableId): Promise<Order[]>
  ```
- Create `services/calculator.service.ts` (pure functions, easily testable):
  ```typescript
  calculateSubtotal(items: OrderItem[]): number
  applyDiscount(subtotal: number, discount: Discount): number
  calculateTax(amountAfterDiscount: number, taxRate: number): number  // PPN 11%
  calculateServiceCharge(amountAfterDiscount: number, serviceRate: number): number
  calculateRounding(total: number): { roundingAmount: number, roundedTotal: number }
  // Indonesian rounding: round to nearest 100 IDR
  ```
- All functions should:
  - Use PowerSync for database operations
  - Log operations with `[OrderService]` prefix
  - Throw descriptive errors for user feedback
  - Handle edge cases (empty order, negative qty, etc.)

**Verification:** Unit test each calculation function, integration test full order flow with real items, verify totals match manual calculation.

---

#### Step 7f — Order Screen Integration

**Goal:** Wire all components together in the main order screen.

**Actions:**
- Update `app/(app)/order/[tableId].tsx`:
  - Split layout: 65% MenuGrid (left) | 35% OrderPanel (right)
  - Header bar: table info, sync status indicator, back button
  - Load/create order on mount based on `tableId` param
  - Handle menu item tap → direct add OR modifier picker
  - Real-time total updates via PowerSync `useQuery`
  - Handle "Send to Kitchen" → create KOT (calls Step 8 service)
  - Handle "Hold" → save order, return to floor view
  - Handle "Payment" → navigate to `checkout/[orderId]`
- Create `hooks/use-order.ts`:
  ```typescript
  {
    order: Order | null,
    items: OrderItemWithModifiers[],
    isLoading: boolean,
    totals: OrderTotals,
    addItem: (item, qty, modifiers, notes, weight) => Promise<void>,
    updateQuantity: (itemId, qty) => Promise<void>,
    removeItem: (itemId) => Promise<void>,
    updateNotes: (itemId, notes) => Promise<void>,
    sendToKitchen: () => Promise<void>,
    holdOrder: () => void,
    goToPayment: () => void,
  }
  ```

**Screen Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Table A3          Order #ORD-20250120-001       ● Synced    │
├───────────────────────────────────────────┬─────────────────────┤
│ [Makanan] [Minuman] [Snacks] [Dessert]    │ Table A3            │
│                                           │ ORD-20250120-001    │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐      │ Guests: [- 2 +]     │
│ │ Nasi    │ │ Mie     │ │ Ayam    │      ├─────────────────────┤
│ │ Goreng  │ │ Goreng  │ │ Bakar   │      │ • Nasi Goreng x2    │
│ │ Rp35.000│ │ Rp30.000│ │ Rp45.000│      │   + Pedas Sedang    │
│ └─────────┘ └─────────┘ └─────────┘      │   Rp75.000          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐      │                     │
│ │ Sate    │ │ Ikan    │ │ Sop     │      │ • Ikan Gurame       │
│ │ Ayam    │ │ Bakar ⚖ │ │ Buntut  │      │   0.4kg Bakar       │
│ │ Rp40.000│ │ Rp84.000│ │ Rp55.000│      │   Rp84.000          │
│ └─────────┘ └─────────┘ └─────────┘      ├─────────────────────┤
│                                           │ Subtotal   159.000  │
│                                           │ Tax (11%)   17.490  │
│                                           │ Total      176.490  │
│                                           ├─────────────────────┤
│                                           │ [Send to Kitchen]   │
│                                           │ [Hold]  [Payment]   │
└───────────────────────────────────────────┴─────────────────────┘
```

**Verification:** Full flow: tap table → order screen loads → add items (direct and with modifiers) → see correct totals → send to kitchen creates KOT → payment navigates to checkout.

---

**Step 7 Complete Verification:**
1. Category tabs scroll, sub-categories show in secondary row
2. Menu grid shows 4 columns with correct category colors
3. Items without modifiers add on tap (no confirmation)
4. Items with modifiers open full-screen picker
5. Weight items show numpad for manual entry
6. Order panel shows items, totals, actions
7. Swipe to delete, tap to edit works
8. Totals calculate correctly (subtotal, tax 11%, service, rounding)
9. Send to Kitchen creates KOT
10. All data persists to SQLite and syncs to Supabase

---

### Step 8 — Kitchen Order Tickets (KOT) & Kitchen Display

**Goal:** When cashier sends order to kitchen, generate a KOT. Kitchen display shows live ticket queue.

**Actions:**
- Create `src/services/kitchen.service.ts`:
  - `createKOT(orderId, items[])` — generates ticket number, creates `kitchen_order_tickets` + `kot_items`
  - `updateKOTStatus(kotId, status)` — pending → in_progress → ready → served
  - `updateKOTItemStatus(kotItemId, status)`
- Create `src/hooks/use-kitchen.ts` — live query of active KOTs (pending + in_progress + ready), ordered by priority + created_at
- Create `src/components/kitchen/KOTCard.tsx` — ticket card showing: ticket number, table number, order type (dine-in badge / takeaway badge), elapsed time (turns red after threshold), list of items with modifiers and notes, status buttons
- Create `app/(app)/kitchen/index.tsx` — full-screen KDS (Kitchen Display System): 3-column Kanban-style layout (Pending | In Progress | Ready). KOT cards move between columns. Tap item → mark as done. When all items done → ticket auto-moves. Large fonts, high contrast for kitchen visibility
- Wire "Send to Kitchen" button in the order screen to call `createKOT`
- When KOT is created, order status changes to `confirmed` → `preparing`

**Verification:** Cashier creates order, taps "Send to Kitchen" → KOT appears on kitchen device. Chef taps items as done → ticket moves to "Ready". Cashier sees order status update.

---

### Step 9 — Bluetooth Printer Integration (ESC/POS)

**Goal:** Print KOTs to kitchen printer and receipts to cashier printer via Bluetooth.

**Actions:**
- Install `react-native-bluetooth-escpos-printer` or `react-native-thermal-receipt-printer` (evaluate which supports Android Bluetooth better)
- Create `src/lib/printer.ts` — abstraction layer:
  - `discoverPrinters()` — scan for Bluetooth devices
  - `connectPrinter(address, type: 'kitchen' | 'cashier')`
  - `printKOT(kot, orderItems, tableName)` — formats KOT ticket: timestamp, table, items with qty/modifiers/notes, priority marker
  - `printReceipt(order, orderItems, payments, branch)` — formats receipt: branch header, order number, items with prices, subtotal, discount, tax, service charge, total, payment methods, footer
  - `printBill(order, orderItems, branch)` — pre-payment bill for customer review
  - `openCashDrawer()` — sends drawer kick command
- Create `src/hooks/use-printer.ts` — manages printer connections, stores paired printer addresses in AsyncStorage, auto-reconnect
- Create settings UI in `app/(app)/settings/index.tsx` — pair kitchen printer, pair cashier printer, test print, paper width selection (58mm / 80mm)
- Auto-print KOT when "Send to Kitchen" is tapped
- Auto-print receipt after successful payment

**Receipt format:** Branch name + address, order number, date/time, table number, items (name, qty, modifiers, price), subtotal, discount name + amount, tax (PPN), service charge, total, payment method(s), "Terima kasih!" footer.

**Verification:** Pair a Bluetooth thermal printer → send test print. Create order → send to kitchen → KOT prints on kitchen printer. Complete payment → receipt prints on cashier printer.

---

### Step 10 — Payment & Checkout

**Goal:** Process payments with split-payment support, apply discounts, and close the bill.

**Actions:**
- Create `src/services/payment.service.ts`:
  - `applyDiscount(orderId, discountId, appliedBy)` — validates eligibility (min order, date range), calculates applied amount with cap
  - `processPayment(orderId, shiftId, method, amount, referenceNumber?)` — creates `payments` record, updates the order's payment status. Supports partial (split) payments
  - `calculateChange(totalDue, cashReceived)` — for cash payments
  - `completeOrder(orderId)` — marks order as `completed`, table as `available`, updates customer loyalty points + total_spent
- Create `src/components/payment/PaymentMethodSelector.tsx` — large buttons for: Cash, QRIS, Debit Card, Credit Card, E-Wallet, Bank Transfer
- Create `src/components/payment/CashPayment.tsx` — numpad for amount entry, quick buttons (50k, 100k, exact), shows change
- Create `src/components/payment/SplitPayment.tsx` — add multiple payment methods, shows remaining balance
- Create `src/components/payment/DiscountSelector.tsx` — list of applicable discounts with eligibility check
- Create `app/(app)/checkout/[orderId].tsx` — full checkout screen: order summary (read-only), discount section, payment section, "Complete & Print" button
- After payment completes: print receipt, update table status, update shift cash totals

**Verification:** Order on table V1, total 471,000 → apply "Paket Keluarga 15%" → new total. Split payment: 400k QRIS + remaining cash → change calculated → order completed → receipt prints → table V1 turns green.

---

### Step 11 — Customer & Reservation Management

**Goal:** Look up customers, assign to orders for loyalty tracking, manage reservations.

**Actions:**
- Create `src/hooks/use-customers.ts` — search customers by name/phone, create new customer, update loyalty points
- Create `app/(app)/customers/index.tsx` — customer list with search, tap to view history (past orders, total spent, loyalty points), add new customer form
- Wire customer assignment into the order flow: optional step when creating an order — search or create customer
- Create reservation management in `app/(app)/floor/index.tsx`: long-press a table → create/view reservation. Show reserved tables with customer name and time. Auto-status: confirmed → seated (when order starts) → completed (when order closes)

**Verification:** Search "Pak Harto" → see 1500 loyalty points, 25 visits. Assign to new order. After payment, loyalty points increase.

---

### Step 12 — Inventory Management

**Goal:** Track stock levels, show low-stock alerts, auto-deduct on order completion.

**Actions:**
- Create `src/services/inventory.service.ts`:
  - `deductStock(branchId, menuItemId, quantity)` — creates `inventory_movements` with type `sale_out`
  - `addStock(branchId, menuItemId, quantity, userId, reason)` — for manual adjustments or purchase receiving
  - `getLowStockItems(branchId)` — items below threshold
  - `getStockMovements(inventoryId)` — full audit trail
- Create `src/hooks/use-inventory.ts` — live query of stock levels, low-stock alerts
- Create `app/(app)/inventory/index.tsx` — list of items with current stock, color-coded (red if below threshold). Tap item → view movement history, adjust stock manually
- Auto-deduct stock when order status → `completed`
- Show "Low Stock" badge on menu items in the order screen when stock is low
- Mark item as `is_available = false` when stock reaches 0

**Verification:** Ikan Gurame stock at 15kg → complete order with 0.4kg → stock shows 14.6kg. Manually adjust → movement logged.

---

### Step 13 — Reports & Analytics

**Goal:** Basic operational reports for managers.

**Actions:**
- Create `app/(app)/reports/index.tsx` with tabs for:
  - **Daily Sales:** total revenue, order count, average order value, payment method breakdown
  - **Item Sales:** top-selling items, revenue per category
  - **Shift Summary:** per-shift cash reconciliation, order count, total
  - **Hourly Heatmap:** orders per hour to identify peak times
- All queries run against local SQLite (works offline) — no need for API calls
- Date range picker for filtering
- Role-gated: only `admin` and `manager` roles can access

**Verification:** Manager opens reports → sees today's sales for Kemang branch, top items, shift summaries.

---

### Step 14 — Polish, Guards & Edge Cases

**Goal:** Harden for real-world restaurant use.

**Actions:**
- **Void/refund flow:** Manager PIN override required to void items or orders. Logs to `audit_logs`
- **Order locking:** prevent two devices from editing the same order simultaneously (optimistic lock via `updated_at`)
- **Network status indicator:** show sync status (green dot = synced, yellow = syncing, red = offline) in the app header
- **Error boundaries:** catch crashes gracefully, never lose local data
- **Auto-retry sync:** PowerSync handles this, but add visual feedback
- **Idle timeout → PIN lock:** configurable per branch
- **Accessibility:** large font sizes (min 16sp), high contrast ratios, touch targets ≥ 48dp (critical for kitchen use with wet/dirty hands)
- **Sound/haptic feedback:** order received sound on kitchen display, haptic on button presses

---

**Verification (End-to-End)**

Full workflow test:
1. First launch → register device as "Kasir 1" on Kemang branch
2. Login with email → open shift (500k) on this device → see floor plan
3. Tap table A3 → new dine-in order for 2 guests
4. Tap "Nasi Goreng Spesial" (no modifiers) → **adds directly** to order
5. Tap "Ikan Gurame" (weight-based) → modifier picker opens → enter 0.4kg → select "Bakar" → add to order
6. Add modifiers to Nasi Goreng via quick edit → see totals update
7. Send to Kitchen → KOT prints on kitchen printer → appears on kitchen display
8. Chef marks items done → order status → ready → served
9. Tap payment → apply Happy Hour 10% discount → pay with cash 200k
10. Receipt prints → table A3 turns green → stock deducted
11. Log out → different user logs in on same device → **same shift still active** (device-scoped)
12. Close shift → cash reconciliation → shift closed
13. Turn off Wi-Fi → repeat steps 3-10 → everything works offline
14. Turn on Wi-Fi → data syncs to Supabase

**Decisions**
- **NativeWind (Tailwind CSS)** — zero-runtime, utility-first styling via `className` prop, trivial Expo setup, built-in dark mode, familiar Tailwind DX
- **Branch locked per device** — each tablet is registered to a branch on first launch. Device identity persists via AsyncStorage UUID. Simplifies data scoping and sync rules
- **Shifts scoped to device, not user** — the cash drawer is a physical thing attached to a terminal. When user B relieves user A at the same register, the money stays. Operator changes, shift doesn't
- **Bluetooth thermal printers** — ESC/POS protocol, most common in Indonesian restaurants
- **Email + PIN auth** — Supabase handles email auth, PIN validated locally for offline quick-unlock
- **Global sync bucket for now** — will scope to per-branch buckets when ready (Step 2 keeps this extensible)
- **Toast POS color system** — 28 button colors in 7 families for category differentiation:
  ```
  ORANGE:    #8f5f3d, #7e4116, #803500 (primary), #682d03
  TERRACOTTA: #7e635d, #74504D, #722e25, #561408
  YELLOW:    #7e6b44, #7b5f27, #7c5000, #633d09
  GRASS:     #657552, #556e34, #37570a, #113a00
  SKY:       #637486, #4d6074, #2a456b, #213554
  LAVENDER:  #78668a, #5e4776, #402960, #25174f
  GRAY:      #6c6c6c, #5f5f5f, #474747, #404040
  ```
  Categories store `button_color` in database (nullable, defaults to `#334155` slate)
- **Modifier picker: full-screen modal** — optimized for tablet landscape, not bottom sheet
- **Weight input: manual entry** — numpad for weight-based items, no scale integration
- **Direct add for simple items** — items with no modifiers add immediately on tap, no confirmation modal
