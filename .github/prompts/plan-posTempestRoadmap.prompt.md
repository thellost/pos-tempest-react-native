## Plan: POS Tempest — Restaurant POS Development

**TL;DR:** Build an offline-first restaurant POS app on Android tablets using Expo + PowerSync + SQLite + Supabase + NativeWind. The app supports open tables/bills, kitchen & cashier Bluetooth thermal printing, PIN-based quick auth, and is structured for long-term maintainability. 13 steps, executed sequentially.

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
- Create `src/db/schema.ts` — define only the needed tables from the ERD as PowerSync `Table` definitions with correct column types. Map enums to `TEXT`, decimals to `REAL`, booleans to `INTEGER`, timestamps to `TEXT` , for now ive completed that task you can just refactor it to differenty folder structure
- Create `src/db/provider.tsx` — initialize `PowerSyncDatabase` with the schema, wrap app in `PowerSyncContext.Provider`
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

### Step 4 — Shift Management

**Goal:** Cashiers must open a shift before taking orders. This gates the entire POS workflow.

**Actions:**
- Create `src/services/shift.service.ts` — `openShift(userId, branchId, openingCash)`, `closeShift(shiftId, closingCash)`, `getActiveShift(userId)`
- Create `src/hooks/use-shift.ts` — provides current active shift to the app, checks if shift is open
- Create `app/(app)/shifts/index.tsx` — UI to open shift (enter opening cash amount via numpad), view current shift summary, close shift (enter closing cash, show expected vs actual, calculate difference)
- Add shift guard in `app/(app)/_layout.tsx`: if role is `cashier` and no open shift, redirect to shift screen before allowing access to order/floor screens

**Verification:** Open shift with 500,000 IDR → shift saved locally → synced to Supabase. Close shift → cash reconciliation shown.

---

### Step 5 — Floor & Table Management

**Goal:** Show a visual floor plan so staff can see table status and tap to open/manage orders.

**Actions:**
- Create `src/hooks/use-tables.ts` — queries `floor_areas` + `tables` for the current branch, joins with active `orders` to show occupied status and current bill total
- Create `src/components/floor/FloorAreaTabs.tsx` — horizontal tabs for floor areas (Indoor, Outdoor, VIP)
- Create `src/components/floor/TableCard.tsx` — card per table showing: table number, capacity, status (color-coded: green=available, red=occupied, yellow=reserved, gray=maintenance), guest count, current order total, elapsed time since order opened
- Create `app/(app)/floor/index.tsx` — grid of `TableCard` components, grouped by floor area via tabs. Tap available table → create new order → navigate to order screen. Tap occupied table → navigate to existing order
- Handle table status updates reactively via PowerSync live queries

**Verification:** See all Kemang tables across Indoor/Outdoor/VIP. Tap A3 → opens order screen. Table turns red. Other devices see the update after sync.

---

### Step 6 — Menu Display & Order Creation (Core POS)

**Goal:** The main order-taking screen — split panel with menu grid on the left and order summary on the right (Toast POS style).

**Actions:**
- Create `src/hooks/use-menu.ts` — queries `categories` (with hierarchy) + `menu_items` filtered by `is_active` and `is_available`, sorted by `sort_order`
- Create `src/services/order.service.ts` — all order logic:
  - `createOrder(branchId, tableId, cashierId, shiftId, orderType, guestCount)`
  - `addItemToOrder(orderId, menuItem, quantity, modifiers[], notes, weight?)`
  - `removeItemFromOrder(orderItemId)`
  - `updateItemQuantity(orderItemId, newQty)`
  - `updateItemNotes(orderItemId, notes)`
  - `calculateOrderTotals(orderId)` — subtotal, tax, service charge, discounts, rounding, total
  - `voidOrder(orderId, voidedBy, reason)`
  - `voidItem(orderItemId, voidedBy, reason)`
- Create `src/components/menu/CategoryTabs.tsx` — top-level categories as horizontal tabs, sub-categories as a secondary row
- Create `src/components/menu/MenuGrid.tsx` — responsive grid of menu item cards
- Create `src/components/menu/MenuItemCard.tsx` — shows name, price, unit, availability. Color/icon for weight-based items. Tap → either add directly or open modifier picker
- Create `src/components/menu/ModifierPicker.tsx` — bottom sheet or modal showing modifier groups for the selected item. Respects `is_required`, `min_selections`, `max_selections`. For weight-based items, includes a numeric input for weight
- Create `src/components/order/OrderPanel.tsx` — right-side panel: guest count, order items list, each with qty/modifiers/subtotal, running totals (subtotal, tax, service, total)
- Create `src/components/order/OrderItemRow.tsx` — swipeable row: tap to edit qty/notes, swipe to remove, shows modifiers inline
- Create `app/(app)/order/[tableId].tsx` — split layout: 65% menu | 35% order panel. Header shows table number + order number. Bottom bar: "Send to Kitchen" + "Payment" buttons

**Weight-based flow:** Tap weight-based item → numeric keypad for weight → compute price (weight × unit price) → add to order.

**Verification:** Create order on table A3 → add Nasi Goreng Spesial with Pedas Sedang + Telur Ceplok → add Ikan Gurame 0.4kg Bakar → see correct totals. Items persist in SQLite, sync to Supabase.

---

### Step 7 — Kitchen Order Tickets (KOT) & Kitchen Display

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

### Step 8 — Bluetooth Printer Integration (ESC/POS)

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

### Step 9 — Payment & Checkout

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

### Step 10 — Customer & Reservation Management

**Goal:** Look up customers, assign to orders for loyalty tracking, manage reservations.

**Actions:**
- Create `src/hooks/use-customers.ts` — search customers by name/phone, create new customer, update loyalty points
- Create `app/(app)/customers/index.tsx` — customer list with search, tap to view history (past orders, total spent, loyalty points), add new customer form
- Wire customer assignment into the order flow: optional step when creating an order — search or create customer
- Create reservation management in `app/(app)/floor/index.tsx`: long-press a table → create/view reservation. Show reserved tables with customer name and time. Auto-status: confirmed → seated (when order starts) → completed (when order closes)

**Verification:** Search "Pak Harto" → see 1500 loyalty points, 25 visits. Assign to new order. After payment, loyalty points increase.

---

### Step 11 — Inventory Management

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

### Step 12 — Reports & Analytics

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

### Step 13 — Polish, Guards & Edge Cases

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
1. Login with email → open shift (500k) → see floor plan
2. Tap table A3 → new dine-in order for 2 guests
3. Add Nasi Goreng Spesial (Pedas Sedang, Telur Ceplok) × 2 + Ikan Gurame 0.4kg (Bakar)
4. Send to Kitchen → KOT prints on kitchen printer → appears on kitchen display
5. Chef marks items done → order status → ready → served
6. Tap payment → apply Happy Hour 10% discount → pay with cash 200k
7. Receipt prints → table A3 turns green → stock deducted
8. Close shift → cash reconciliation → shift closed
9. Turn off Wi-Fi → repeat steps 2-7 → everything works offline
10. Turn on Wi-Fi → data syncs to Supabase

**Decisions**
- **NativeWind (Tailwind CSS)** — zero-runtime, utility-first styling via `className` prop, trivial Expo setup, built-in dark mode, familiar Tailwind DX
- **Branch locked per device** — simplifies data scoping and sync rules
- **Bluetooth thermal printers** — ESC/POS protocol, most common in Indonesian restaurants
- **Email + PIN auth** — Supabase handles email auth, PIN validated locally for offline quick-unlock
- **Global sync bucket for now** — will scope to per-branch buckets when ready (Step 2 keeps this extensible)
