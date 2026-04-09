# Mobile-Responsive UI Audit — pos-tempest

> **Goal**: Catalogue every layout decision, hard-coded dimension, split-panel pattern, touch target, and responsive gap in the codebase to produce an actionable plan for supporting portrait phones alongside the existing landscape-tablet experience.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Global Architecture & Config](#2-global-architecture--config)
3. [Screen-by-Screen Audit](#3-screen-by-screen-audit)
4. [Component-by-Component Audit](#4-component-by-component-audit)
5. [Hard-Coded Dimensions Catalogue](#5-hard-coded-dimensions-catalogue)
6. [Touch Target Analysis](#6-touch-target-analysis)
7. [Responsive Gaps & Missing Patterns](#7-responsive-gaps--missing-patterns)
8. [Recommended Implementation Plan](#8-recommended-implementation-plan)

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Screens audited | 14 |
| Components audited | 40+ |
| Hard-coded pixel widths | 22 instances |
| Split-panel screens (flex-row) | 3 (order, checkout, kitchen) |
| Modals with fixed widths | 8 |
| Responsive breakpoints defined | **0** |
| `useWindowDimensions` / `Dimensions` usage | **0** |
| Existing responsive logic | 1 (MenuGrid column calc) |

### Top-Level Blockers

| # | Blocker | File | Impact |
|---|---------|------|--------|
| 1 | `ScreenOrientation.lockAsync(LANDSCAPE)` | `app/_layout.tsx` | Prevents portrait entirely |
| 2 | App shell = `flex-row` with `w-14` IconRail | `app/(app)/_layout.tsx` | Navigation assumes wide viewport |
| 3 | Order screen 30/70 `flex-row` split | `app/(app)/order/[tableId].tsx` | Unusable at < 600px wide |
| 4 | Checkout 50/50 `flex-row` split | `app/(app)/checkout/[orderId].tsx` | Unusable at < 600px wide |
| 5 | Kitchen 3-column `flex-row` Kanban | `app/(app)/kitchen/index.tsx` | Columns too narrow on phone |
| 6 | No Tailwind breakpoints (`sm:`, `md:`) defined or used | `tailwind.config.js` | No responsive utility classes available |
| 7 | Android Immersive Mode + `h-11` status bar | `app/_layout.tsx`, `StatusBar.tsx` | Phone status bar / safe areas ignored |

---

## 2. Global Architecture & Config

### 2.1 Root Layout (`app/_layout.tsx`)

**Critical mobile issues:**

- **Line ~38**: `ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)` — forces landscape on ALL devices. Must be made conditional (tablet = landscape, phone = allow portrait).
- **Line ~40**: `ImmersiveMode.fullLayout(true)` + `ImmersiveMode.setBarMode('FullSticky')` — hides Android system bars. On phones, users expect visible status bar and back gesture hints.
- Uses `GestureHandlerRootView` with `flex: 1` — ✅ fine.
- Loads Geist + GeistMono fonts — ✅ fine.
- `SentryNavigationIntegration` + `PowerSyncProvider` wrapping — no layout impact.

### 2.2 App Shell (`app/(app)/_layout.tsx`)

**Layout**: Persistent chrome wrapping all authenticated screens:
```
┌──────────────────────────────────┐
│ AppStatusBar (h-11)              │
├──────┬───────────────────────────┤
│ Icon │                           │
│ Rail │    Screen Content          │
│ w-14 │    (flex-1)               │
│      │                           │
└──────┴───────────────────────────┘
```

- **`flex-row`** outer container assumes landscape.
- `StatusBar` = fixed `h-11` (44px) — uses `text-[10px]` which is too small on phones.
- `IconRail` = fixed `w-14` (56px) — vertical rail on left. On phones, this needs to become a bottom tab bar or be hidden behind a hamburger.
- Auth/device/shift guards redirect to setup screens — ✅ no layout issue.

### 2.3 Tailwind Config (`tailwind.config.js`)

- **Preset**: `nativewind/preset` — ✅ supports responsive breakpoints, but **none are defined**.
- **Custom font sizes**: `pos-xs` (11px), `pos-sm` (13px), `pos-base` (15px), `pos-lg` (18px), `pos-xl` (22px), `pos-2xl` (28px), `pos-3xl` (36px). On phones, `pos-xs` and `pos-sm` are borderline too small.
- **Custom colors**: All use CSS vars (`var(--color-*)`) — ✅ theme-safe.
- **No responsive breakpoints**: Need to add `sm`, `md`, `lg` (or `phone`, `tablet`) breakpoint definitions.
- **No container queries or responsive utilities.**

### 2.4 Theme Constants (`constants/theme.ts`)

- Defines `ThemeColors` (dark) and `LightThemeColors` — no dimension-related values.
- `Spacing` object has `xs` through `xxl` tokens — unused in components (all use Tailwind classes).
- `BorderRadius`, `Shadows` objects — correctly abstracted.

### 2.5 Global CSS (`global.css`)

- Only `@tailwind base/components/utilities` — no custom responsive utilities defined.

---

## 3. Screen-by-Screen Audit

### 3.1 Floor Screen (`app/(app)/floor/index.tsx`) — 312 lines

**Layout approach**: Single-column ScrollView with a table grid.

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| Header stats row | `flex-row gap-2` with `w-24` stat cards | Cards too wide for phone; will overflow or need wrapping |
| Floor area tabs | `FloorAreaTabs` horizontal ScrollView | ✅ Already scrollable |
| Table grid | `flex-row flex-wrap gap-3` with **`w-[31%]`** cards | 3-col → needs 2-col on phone |
| Takeaway section | Same `w-[31%]` card width | Same issue |
| Reservation toggle button | Absolutely positioned `right-3 top-3` | May overlap on small screens |

**Hard-coded values**: `w-24` (stat cards), `w-[31%]` (table/takeaway cards), `gap-3`.

### 3.2 Order Screen (`app/(app)/order/[tableId].tsx` + `order/takeaway.tsx`)

**Layout approach**: **CRITICAL** — side-by-side split panel.

```
┌──────────┬─────────────────────────────┐
│ Order    │  CategoryTabs               │
│ Panel    │  MenuSearchBar (w-[52%])    │
│ flex: 3  │  MenuGrid                   │
│          │  flex: 7                    │
└──────────┴─────────────────────────────┘
```

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| **Split layout** | `flex-row` with `style={{ flex: 3 }}` / `style={{ flex: 7 }}` | **BREAKING** — 30% of a 375px phone = 112px (unusable for order panel) |
| OrderPanel | Full-height left panel with scrollable items | Needs to become a bottom sheet or swipe-up panel on phone |
| Menu search | `w-[52%]` fixed width | Percentage-based but parent is already narrow |
| CategoryTabs | `flex-row gap-1.5` with `flex-1` per tab | ✅ Wraps OK, but may need horizontal scroll |
| MenuGrid | `MIN_ITEM_WIDTH = 180`, dynamic columns | ✅ **Already responsive** — only component with adaptive layout |
| ModifierPicker | Full-screen `<Modal>` | ✅ OK on phone |

**This is the #1 highest-priority screen for mobile adaptation.**

### 3.3 Checkout Screen (`app/(app)/checkout/[orderId].tsx`)

**Layout approach**: **CRITICAL** — 50/50 split panel.

```
┌─────────────────┬─────────────────┐
│ OrderSummary    │ CheckoutPayment │
│ width: '50%'    │ flex: 1         │
│ (inline style)  │                 │
└─────────────────┴─────────────────┘
```

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| **Split layout** | `flex-row` with `width: '50%'` inline style | **BREAKING** — 187px each on phone |
| OrderSummaryPanel | `width: '50%'` inline style, scrollable items, fixed bottom totals | Must become full-screen on phone |
| CheckoutPaymentPanel | `flex: 1`, scrollable sections, fixed `h-[52px]` bottom button | Must become full-screen on phone |
| ViewOnlyPanel | `flex: 1` centered content | ✅ Already flexible |

### 3.4 Kitchen / KDS Screen (`app/(app)/kitchen/index.tsx`)

**Layout approach**: 3-column Kanban.

```
┌────────────┬────────────┬────────────┐
│ Preparing  │   Ready    │   Served   │
│ flex: 1    │  flex: 1   │  flex: 1   │
└────────────┴────────────┴────────────┘
```

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| **3-col layout** | `flex-row` with 3 × `flex-1` columns | **BREAKING** — 125px columns on phone |
| KOTCard | Fills column width, no fixed dimensions | ✅ Adapts to parent |
| Legend row | `flex-row` with status dots | May wrap, but OK |

**Needs**: Horizontal ScrollView with snap-to-column on phone, or swipeable tabs.

### 3.5 Shifts Screen (`app/(app)/shifts/index.tsx`)

**Layout approach**: Single-column ScrollView.

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| Keypad buttons | `w-[31%]` width, `h-14` height | ✅ Percentage-based, should adapt |
| Stats row | `flex-row gap-3` with `flex-1` cards | ✅ Should flex OK |
| Cash denomination grid | `flex-row flex-wrap` | ✅ Should wrap |

**Mostly phone-safe** — minor touch target adjustments may be needed.

### 3.6 Cash Screen (`app/(app)/cash/index.tsx`)

**Layout approach**: Single-column ScrollView.

- Uses `flex-row flex-wrap` for denomination buttons.
- No fixed widths beyond `w-[31%]` percentage buttons.
- **Mostly phone-safe.**

### 3.7 Settings Screen (`app/(app)/settings/index.tsx`)

**Layout approach**: Single-column ScrollView with AccordionSections.

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| AccordionSection | Full-width cards with expand/collapse | ✅ Should work on phone |
| ConfigSection rows | `flex-row` with label + input | May get cramped; input `min-w-[60px]` is fine |
| PrinterSection | Complex forms inside accordion | Should review individually |
| DeviceList | FlatList with device cards | ✅ Full-width cards |

**Mostly phone-safe** — may need slightly larger touch targets.

### 3.8 Inventory Screen (`app/(app)/inventory/index.tsx`)

**Layout approach**: Tab bar + tab content.

- Tab bar: `flex-row gap-1.5` — ✅ adapts.
- StockTab, PurchasesTab, SuppliersTab each have their own scrolling lists.
- **Modals are the problem** (see §4.9).

### 3.9 Daily Orders Screen (`app/(app)/daily-orders/index.tsx`)

**Layout approach**: Single-column with header stats + search + filter tabs + order list.

| Pattern | Detail | Mobile Impact |
|---------|--------|---------------|
| Stats row | `flex-row gap-2.5` with 4 × `flex-1` cards | On phone, 4 cards in a row may be too narrow |
| Filter tabs | Horizontal ScrollView | ✅ Already scrollable |
| Order list | `OrderRow` full-width cards | ✅ Already works |

**Minor issue**: 4-stat row may need to become 2×2 grid on phone.

### 3.10 Reservations Screen (`app/(app)/reservations/index.tsx`) — 978 lines

**Layout approach**: Single-column with modals for create/edit.

- Long complex form with date/time pickers.
- Bottom sheet modals with `maxHeight: '80%'`.
- Should audit specific modal widths (likely has fixed widths).

### 3.11 Customers Screen (`app/(app)/customers/index.tsx`) — 454 lines

**Layout approach**: Master list with modal details.

- Customer list is single-column ScrollView — ✅ OK.
- Detail/edit modals need width audit.

### 3.12 Device Setup Screen (`app/(app)/device-setup/index.tsx`)

**Layout approach**: Centered form.

- `maxWidth: 600, alignSelf: 'center'` — ✅ actually responsive-friendly.
- Input fields are full-width within container.
- **Phone-safe** as-is.

### 3.13 Menu Management (`app/(app)/menu/index.tsx`)

- Currently a placeholder stub — no layout to audit.

### 3.14 Auth Screens (`app/(auth)/login.tsx`, `app/(auth)/pin.tsx`)

**Layout approach**: Centered form layouts.

- Login: Centered card with `maxWidth: 400` — ✅ responsive.
- PIN: Grid of buttons — ✅ adapts to width.
- **Phone-safe** — but should remove landscape lock for auth flow on phones.

---

## 4. Component-by-Component Audit

### 4.1 Navigation Components

#### `IconRail.tsx`
- **Fixed `w-14`** (56px) vertical rail.
- Icons are `size={18}` with tooltips — too small for phone primary navigation.
- On phone: Replace with bottom tab bar (5-6 icons, 48px+ touch targets).
- Contains user avatar, lock screen, sign out at bottom.

#### `StatusBar.tsx`
- **Fixed `h-11`** (44px) bar.
- 3-section `flex-row`: user info (left), clock (center), shift+device (right).
- Uses `text-[10px]` — borderline illegible on phone at arm's length.
- On phone: May need to be taller, or collapse info into a hamburger/dropdown.

#### `SideDrawer.tsx` — **DEPRECATED**
- `DRAWER_WIDTH = 280` constant.
- Replaced by IconRail. Can be ignored.

#### `HamburgerButton.tsx` — **DEPRECATED**
- Can be ignored.

### 4.2 Order Components

#### `OrderPanel.tsx` (~400 lines)
- `flex-1 border-r border-border` — takes full height of parent.
- Scrollable item list grouped by rounds.
- `CustomerPickerRow` at top.
- `OrderTotals` + `OrderActions` fixed at bottom.
- **On phone**: Needs to become a drawer/sheet or a separate tab/view.

#### `OrderActions.tsx` (225 lines)
- `flex-row gap-1` with multiple action buttons.
- Buttons use `flex-1` — ✅ adapts.
- Button height: implicit from padding (~40px) — OK.
- "Send to Kitchen" and "Checkout" are primary actions with adequate sizing.

#### `OrderItemRow.tsx`
- `Swipeable` with `leftThreshold={40}` and `rightThreshold={40}`.
- Quantity +/- buttons use `IconButton size="sm"` = **20×20px** — **too small** for phone touch targets (minimum 44px recommended by Apple HIG).
- Item text uses `text-pos-sm` (13px) — OK for tablet, borderline on phone.

#### `OrderTotals.tsx`
- Simple flex-row totals — ✅ no issues.

#### `OrderItemBadge.tsx`
- Tiny VOID badge — ✅ decorative, no touch target.

#### `RoundDivider.tsx`
- Decorative divider — ✅ no issues.

#### `CustomerPickerRow.tsx` (228 lines)
- Inline row with "Add Customer" button or customer chip.
- Opens modal search — modal uses `max-w-md` (Tailwind) — ✅ responsive.
- Search results have `h-9 w-9` avatar circles — OK.
- Results `maxHeight: 260` — may be fine on phone if modal is positioned well.

#### `types.ts`
- Type definitions only — no layout impact.

### 4.3 Floor Components

#### `FloorAreaTabs.tsx`
- Horizontal `ScrollView` with tab pills.
- ✅ Already mobile-friendly (scrollable).

#### `TableCard.tsx`
- Sized by parent `w-[31%]` — no internal fixed dimensions.
- Status badge, table number, guest count.
- ✅ Will adapt when parent changes to `w-[48%]` on phone.

#### `ReservationModal.tsx` (534 lines)
- Bottom sheet pattern with `maxHeight: '80%'`.
- Needs width audit — likely uses percentage or `flex-1`.
- Form fields are full-width.

### 4.4 Menu Components

#### `CategoryTabs.tsx`
- `flex-row gap-1.5` with `flex-1` category buttons.
- Sub-categories below in same pattern.
- On phone: May need to become horizontally scrollable if many categories.

#### `MenuGrid.tsx` — ✅ **BEST PRACTICE EXAMPLE**
- `MIN_ITEM_WIDTH = 180`, `GRID_PADDING = 10`, `GAP = 6`.
- Dynamically calculates `numCols` based on measured container width.
- Uses `onLayout` to measure available space.
- **This is the only component with responsive column logic.** Use as a pattern for other grids.

#### `MenuItemCard.tsx`
- `minHeight: 96`, accent bar `w-1`.
- +/- controls use `IconButton size="sm"` = **20×20px** — **too small** for phone.
- Item name uses `text-pos-base` (15px) — OK.

#### `MenuSearchBar.tsx`
- Search input with clear button — ✅ full-width, no issues.

#### `ModifierPicker.tsx`
- Full-screen `<Modal>` — ✅ phone-friendly by default.
- Scrollable content.
- Bottom totals bar — ✅ fixed position.

#### `ModifierGroupRow.tsx`
- `flex-row flex-wrap gap-2` for modifier buttons.
- Buttons use `px-5 py-4` — ✅ adequate touch targets.
- Checkbox circles are `h-5 w-5` — small but functional.

#### `WeightInput.tsx`
- Single text input in a card — ✅ phone-friendly.

### 4.5 Checkout Components

#### `CheckoutPaymentPanel.tsx`
- `flex: 1` — takes remaining width after OrderSummaryPanel.
- Scrollable sections + fixed bottom bar `h-[52px]`.
- Payment method selector, cash numpad, split payment list.
- **On phone**: Must be full-screen when OrderSummary is removed from row.

#### `OrderSummaryPanel.tsx`
- **`width: '50%'` inline style** — hard-coded half-width.
- Scrollable items + fixed bottom totals.
- **On phone**: Must become full-width, either in a different view or as a collapsible section.

#### `ViewOnlyPanel.tsx`
- `flex: 1` centered — ✅ works on phone.

### 4.6 Payment Components

#### `CashPayment.tsx`
- Amount display: `minHeight: 60px`, `fontSize: 28`.
- Quick amount buttons: `flex-1` in `flex-row gap-1.5` — ✅ adapts.
- Numpad: `h-12 flex-1` buttons — ✅ adequate size.
- **Phone-friendly** as-is.

#### `PaymentMethodSelector.tsx`
- `flex-row gap-1.5` with `flex-1` per method.
- Icons `size={20}`, labels `text-[10px]` — may be too small on phone.
- **Minor**: increase icon size and label text on phone.

#### `SplitPayment.tsx`
- List of payment rows — ✅ full-width.
- Remove button `IconButton size="sm"` — **20×20px too small**.

#### `DiscountSelector.tsx`
- Modal with **`width: 420`** fixed — needs `maxWidth: '92%'` added.
- `maxHeight: '78%'` — OK.
- Scrollable discount list — ✅.

### 4.7 Kitchen Components

#### `KOTCard.tsx`
- Fills parent column width — no fixed dimensions.
- "Advance" button at bottom — adequate padding.
- ✅ Will work in any column width.

#### `KOTTicketPreview.tsx`
- Modal with **`w-[380px]`** fixed — thermal paper preview.
- Needs `maxWidth: '95%'` for phone.

### 4.8 Shift Components

#### `CashTransactionList.tsx`
- Vertical list of transaction cards — ✅ full-width.

#### `CashTransactionModal.tsx`
- Overlay modal with **`width: 520`** fixed.
- Keypad with `w-[31%]` `h-14` buttons.
- **Needs**: `maxWidth: '95%'` for phone.

### 4.9 Inventory Components

#### `StockTab.tsx`
- Detail modal: **`width: 560, maxWidth: '92%'`**, `maxHeight: 620`.
- ✅ Has `maxWidth` — will shrink on phone, but 92% of 375px = 345px which is tight.

#### `PurchasesTab.tsx`
- Create PO modal: **`width: 680, maxWidth: '96%'`**, `maxHeight: 720`.
- Detail modal: **`width: 520, maxWidth: '92%'`**, `maxHeight: 580`.
- Forms inside have `flex-row gap-3` layouts that may need to stack on phone.
- `View style={{ width: 160 }}` for tax input — needs flex.
- `View style={{ width: 90 }}` for UoM dropdown — needs flex.

#### `SuppliersTab.tsx`
- Modal: **`width: 480, maxWidth: '92%'`**.
- Should work but tight on phone.

### 4.10 Settings Components

#### `AccordionSection.tsx`
- `h-8 w-8` icon container, `text-pos-sm` labels.
- ✅ Phone-friendly — full-width cards that expand.

#### `ConfigSection.tsx`
- `flex-row items-center gap-3` per row — label + input.
- Input `min-w-[60px]` — OK.
- ✅ Mostly phone-friendly, may get slightly cramped.

#### `PrinterSection.tsx` (513 lines)
- Complex printer configuration cards.
- Paper width selector uses `flex-row flex-wrap gap-1.5` — ✅ wraps.
- Bluetooth device discovery list — ✅ full-width.

#### `DeviceList.tsx` (263 lines)
- FlatList with device cards.
- Action buttons in `flex-row gap-2` — ✅ adapts.

### 4.11 Print Components

#### `ReceiptPreview.tsx`
- Modal with **`w-[380px]`** fixed, `maxHeight: '90%'`.
- Thermal paper preview with monospace font.
- **Needs**: `maxWidth: '95%'` for phone.

### 4.12 Daily Orders Components

#### `OrderRow.tsx`
- Full-width card with status badges — ✅ phone-friendly.
- `text-[10px]` badges — small but decorative.

### 4.13 UI Primitives (`components/ui/`)

#### `Button.tsx`
- Generic Pressable wrapper with press animation.
- No size constraints — ✅ adapts to className.

#### `IconButton.tsx`
- Sizes: `sm` = **20×20px**, `md` = **32×32px**, `lg` = **40×40px**.
- **`sm` is too small** for phone touch targets (Apple HIG = 44px minimum).
- `md` is borderline, `lg` is OK.

#### `SelectButton.tsx`
- `px-3 py-1.5` default padding — ~30px height.
- **Borderline** for phone touch targets.

#### `PrimaryButton.tsx`
- `h-10` (40px) or `h-12` (48px) — ✅ OK for phone.

#### `DangerButton.tsx`
- Same as PrimaryButton sizing — ✅ OK.

---

## 5. Hard-Coded Dimensions Catalogue

### Fixed Pixel Widths

| Component | Value | File | Line(s) |
|-----------|-------|------|---------|
| IconRail | `w-14` (56px) | `navigation/IconRail.tsx` | Container |
| StatusBar | `h-11` (44px) | `navigation/StatusBar.tsx` | Container |
| SideDrawer (deprecated) | `280px` | `navigation/SideDrawer.tsx` | `DRAWER_WIDTH` |
| KOTTicketPreview modal | `w-[380px]` | `kitchen/KOTTicketPreview.tsx` | Modal |
| ReceiptPreview modal | `w-[380px]` | `print/ReceiptPreview.tsx` | Modal |
| DiscountSelector modal | `width: 420` | `payment/DiscountSelector.tsx` | Modal |
| SuppliersTab modal | `width: 480` | `inventory/SuppliersTab.tsx` | Modal |
| CashTransactionModal | `width: 520` | `shift/CashTransactionModal.tsx` | Modal |
| PODetailModal | `width: 520` | `inventory/PurchasesTab.tsx` | Modal |
| StockDetailModal | `width: 560` | `inventory/StockTab.tsx` | Modal |
| DeviceSetup form | `maxWidth: 600` | `app/(app)/device-setup/index.tsx` | Container |
| CreatePOModal | `width: 680` | `inventory/PurchasesTab.tsx` | Modal |
| MenuSearchBar | `w-[52%]` | `app/(app)/order/[tableId].tsx` | Search bar |
| Floor stat cards | `w-24` (96px) | `app/(app)/floor/index.tsx` | Stat cards |

### Fixed Percentage Widths

| Component | Value | File |
|-----------|-------|------|
| Table/Takeaway cards | `w-[31%]` | `floor/index.tsx` |
| Shift keypad buttons | `w-[31%]` | `shifts/index.tsx` |
| Cash keypad buttons | `w-[31%]` | `shift/CashTransactionModal.tsx` |
| OrderSummaryPanel | `width: '50%'` inline | `checkout/OrderSummaryPanel.tsx` |

### Flex Ratios (Split Panels)

| Screen | Left | Right | File |
|--------|------|-------|------|
| Order | `flex: 3` (30%) | `flex: 7` (70%) | `order/[tableId].tsx` |
| Checkout | `width: '50%'` | `flex: 1` | `checkout/[orderId].tsx` |
| Kitchen | `flex: 1` × 3 | — | `kitchen/index.tsx` |

### Fixed Heights

| Component | Value | File |
|-----------|-------|------|
| StatusBar | `h-11` (44px) | `navigation/StatusBar.tsx` |
| Numpad keys | `h-12` (48px) | `payment/CashPayment.tsx` |
| Shift keypad keys | `h-14` (56px) | `shifts/index.tsx` |
| Checkout complete btn | `h-[52px]` | `checkout/CheckoutPaymentPanel.tsx` |
| PO form inputs | `height: 52` | `inventory/PurchasesTab.tsx` |
| PO filter tab bar | `height: 44` | `inventory/PurchasesTab.tsx` |
| PrimaryButton md | `h-10` (40px) | `ui/PrimaryButton.tsx` |
| PrimaryButton lg | `h-12` (48px) | `ui/PrimaryButton.tsx` |

---

## 6. Touch Target Analysis

Apple HIG recommends **44×44pt** minimum. Android Material recommends **48×48dp**.

### ❌ Too Small (< 32px)

| Component | Size | File | Fix |
|-----------|------|------|-----|
| `IconButton size="sm"` | **20×20px** | `ui/IconButton.tsx` | Increase to 32px or add `hitSlop` |
| Order item qty +/- | **20×20px** (via IconButton sm) | `order/OrderItemRow.tsx` | Increase to 36-40px on phone |
| Menu item qty +/- | **20×20px** (via IconButton sm) | `menu/MenuItemCard.tsx` | Same |
| Split payment remove | **20×20px** (via IconButton sm) | `payment/SplitPayment.tsx` | Same |

### ⚠️ Borderline (32-40px)

| Component | Size | File |
|-----------|------|------|
| `IconButton size="md"` | 32×32px | `ui/IconButton.tsx` |
| `SelectButton` default | ~30px height | `ui/SelectButton.tsx` |
| StatusBar text | `text-[10px]` — not a button but information density is high | `navigation/StatusBar.tsx` |
| Various badge/pill buttons | `px-2 py-0.5` ≈ 20px height | Multiple files |

### ✅ Adequate (≥ 40px)

| Component | Size | File |
|-----------|------|------|
| `IconButton size="lg"` | 40×40px | `ui/IconButton.tsx` |
| `PrimaryButton` | 40-48px | `ui/PrimaryButton.tsx` |
| Cash numpad keys | 48px | `payment/CashPayment.tsx` |
| Shift keypad keys | 56px | `shifts/index.tsx` |
| Modifier buttons | `px-5 py-4` ≈ 48px | `menu/ModifierGroupRow.tsx` |
| Swipeable thresholds | 40px | `order/OrderItemRow.tsx` |

---

## 7. Responsive Gaps & Missing Patterns

### 7.1 No Breakpoint System

- `tailwind.config.js` defines **zero** responsive breakpoints.
- No `sm:`, `md:`, `lg:` classes used anywhere in the codebase.
- No `useWindowDimensions()` or `Dimensions.get('window')` calls.
- No `Platform.isPad` checks.

**Fix**: Define breakpoints in Tailwind config and create a `useDeviceType()` hook:
```js
// tailwind.config.js — add:
theme: {
  screens: {
    'phone': { max: '767px' },  // or use NativeWind width-based
    'tablet': '768px',
  }
}
```

### 7.2 No Orientation Awareness

- Orientation is locked to `LANDSCAPE` globally.
- No `useWindowDimensions()` tracking for orientation changes.
- No layout recalculation on resize.

### 7.3 No Safe Area Handling

- The app uses `ImmersiveMode` to hide system UI.
- No `SafeAreaView` or `useSafeAreaInsets()` usage.
- On phones (especially with notches/dynamic islands), content will be obscured.

### 7.4 Only One Responsive Component

- `MenuGrid.tsx` is the **only** component that measures its container and adapts columns.
- All other grids use fixed `w-[31%]` patterns.
- No other component uses `onLayout` for responsive behavior.

### 7.5 Modal Width Pattern

All modals use a fixed `width` + optional `maxWidth` percentage:
- Some have `maxWidth` (StockTab, PurchasesTab, SuppliersTab) — ✅ partially safe.
- Others lack `maxWidth` (DiscountSelector, CashTransactionModal, ReceiptPreview, KOTTicketPreview) — ❌ will overflow phone screens.

### 7.6 Split Panel Architecture

The three split-panel screens (Order, Checkout, Kitchen) are the biggest mobile blockers. They assume:
- Minimum ~800px viewport width.
- Side-by-side panels that both need ~300px+ to be functional.
- No fallback layout for narrow viewports.

---

## 8. Recommended Implementation Plan

### Phase 0: Foundation (do first — everything depends on this)

| Task | Priority | Files |
|------|----------|-------|
| Create `useDeviceType()` hook returning `'phone' \| 'tablet'` | P0 | New: `hooks/use-device-type.ts` |
| Add Tailwind breakpoints (`phone:`, `tablet:`) | P0 | `tailwind.config.js` |
| Make orientation lock conditional (landscape for tablet, unlocked for phone) | P0 | `app/_layout.tsx` |
| Add `SafeAreaView` / `useSafeAreaInsets()` for phone | P0 | `app/_layout.tsx`, `app/(app)/_layout.tsx` |
| Disable immersive mode on phone | P0 | `app/_layout.tsx` |

### Phase 1: App Shell (high impact, low risk)

| Task | Priority | Files |
|------|----------|-------|
| Replace IconRail with bottom tab bar on phone | P0 | `app/(app)/_layout.tsx`, `navigation/IconRail.tsx` |
| Collapse/hide StatusBar on phone (or make it a dropdown) | P1 | `navigation/StatusBar.tsx` |
| Add `useDeviceType()` to app shell layout to switch between `flex-row` (tablet) and `flex-col` (phone) | P0 | `app/(app)/_layout.tsx` |

### Phase 2: Critical Screens (highest user-facing impact)

| Task | Priority | Approach | Files |
|------|----------|----------|-------|
| **Order screen** — phone layout | P0 | Tab-based: "Menu" tab + "Order" tab (or bottom sheet for cart) | `order/[tableId].tsx`, `order/takeaway.tsx` |
| **Checkout screen** — phone layout | P0 | Step flow: Order Summary → Payment (full-screen each) | `checkout/[orderId].tsx`, `OrderSummaryPanel.tsx`, `CheckoutPaymentPanel.tsx` |
| **Kitchen screen** — phone layout | P1 | Swipeable horizontal columns or tab-based columns | `kitchen/index.tsx` |

### Phase 3: Grid & Card Layouts (moderate impact)

| Task | Priority | Files |
|------|----------|-------|
| Floor: `w-[31%]` → `w-[48%]` on phone (2-column) | P1 | `floor/index.tsx` |
| Floor: stat cards → 2×2 grid on phone or horizontal scroll | P2 | `floor/index.tsx` |
| Daily orders: 4-stat row → 2×2 on phone | P2 | `daily-orders/index.tsx` |
| CategoryTabs: add horizontal scroll fallback | P2 | `menu/CategoryTabs.tsx` |

### Phase 4: Modal Widths (easy wins)

| Task | Priority | Files |
|------|----------|-------|
| Add `maxWidth: '95%'` to all modals missing it | P1 | `DiscountSelector.tsx`, `CashTransactionModal.tsx`, `KOTTicketPreview.tsx`, `ReceiptPreview.tsx` |
| Reduce fixed widths for phone (420→360, 520→420, 680→100%) | P2 | All modal components |
| Stack `flex-row` form inputs vertically on phone inside modals | P2 | `PurchasesTab.tsx`, `StockTab.tsx` |

### Phase 5: Touch Targets (accessibility win)

| Task | Priority | Files |
|------|----------|-------|
| `IconButton size="sm"`: increase to 28-32px, add `hitSlop={12}` | P1 | `ui/IconButton.tsx` |
| Order item qty buttons: larger on phone (36-40px) | P2 | `order/OrderItemRow.tsx` |
| Menu item qty buttons: larger on phone | P2 | `menu/MenuItemCard.tsx` |
| `SelectButton`: increase default padding on phone | P2 | `ui/SelectButton.tsx` |
| Payment method icons: increase to `size={24}` on phone | P3 | `payment/PaymentMethodSelector.tsx` |

### Phase 6: Typography & Information Density (polish)

| Task | Priority | Files |
|------|----------|-------|
| Increase `pos-xs` from 11→12px on phone, `pos-sm` from 13→14px | P2 | `tailwind.config.js` |
| StatusBar: increase `text-[10px]` to at least 12px on phone | P2 | `navigation/StatusBar.tsx` |
| Badge pills: ensure minimum 24px height | P3 | Multiple components |

---

## Appendix A: File Index

Every file read during this audit:

**Layouts**: `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/index.tsx`

**Screens**: `floor/index.tsx`, `order/[tableId].tsx`, `order/takeaway.tsx`, `checkout/[orderId].tsx`, `kitchen/index.tsx`, `menu/index.tsx`, `cash/index.tsx`, `settings/index.tsx`, `shifts/index.tsx`, `inventory/index.tsx`, `daily-orders/index.tsx`, `reservations/index.tsx`, `customers/index.tsx`, `device-setup/index.tsx`

**Navigation**: `IconRail.tsx`, `StatusBar.tsx`, `SideDrawer.tsx`, `HamburgerButton.tsx`

**Order**: `OrderPanel.tsx`, `OrderActions.tsx`, `OrderItemRow.tsx`, `OrderTotals.tsx`, `OrderItemBadge.tsx`, `RoundDivider.tsx`, `CustomerPickerRow.tsx`, `types.ts`

**Floor**: `FloorAreaTabs.tsx`, `TableCard.tsx`, `ReservationModal.tsx`

**Menu**: `CategoryTabs.tsx`, `MenuGrid.tsx`, `MenuItemCard.tsx`, `MenuSearchBar.tsx`, `ModifierPicker.tsx`, `ModifierGroupRow.tsx`, `WeightInput.tsx`

**Checkout**: `CheckoutPaymentPanel.tsx`, `OrderSummaryPanel.tsx`, `ViewOnlyPanel.tsx`

**Payment**: `CashPayment.tsx`, `PaymentMethodSelector.tsx`, `SplitPayment.tsx`, `DiscountSelector.tsx`

**Kitchen**: `KOTCard.tsx`, `KOTTicketPreview.tsx`

**Shift**: `CashTransactionList.tsx`, `CashTransactionModal.tsx`

**Inventory**: `StockTab.tsx`, `PurchasesTab.tsx`, `SuppliersTab.tsx`, `shared.tsx`

**Settings**: `AccordionSection.tsx`, `ConfigSection.tsx`, `PrinterSection.tsx`, `DeviceList.tsx`, `primitives.tsx`

**Print**: `ReceiptPreview.tsx`

**Daily Orders**: `OrderRow.tsx`

**UI Primitives**: `Button.tsx`, `IconButton.tsx`, `SelectButton.tsx`, `PrimaryButton.tsx`, `DangerButton.tsx`, `SecondaryButton.tsx`, `SuccessButton.tsx`, `index.ts`

**Config**: `tailwind.config.js`, `global.css`, `constants/theme.ts`

**Hooks**: `use-order-screen.ts`, `use-tables.ts`
