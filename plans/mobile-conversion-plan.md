# Mobile Conversion Plan

> **Goal:** Make every screen in pos-tempest work on phones (≥ 375 px portrait) **and** tablets (landscape), keeping the existing tablet experience intact.

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Phase 0 — Foundation (Responsive Infrastructure)](#phase-0--foundation-responsive-infrastructure)
3. [Phase 1 — App Shell & Navigation](#phase-1--app-shell--navigation)
4. [Phase 2 — Core Workflow Screens](#phase-2--core-workflow-screens)
5. [Phase 3 — Secondary Screens](#phase-3--secondary-screens)
6. [Phase 4 — Modals & Overlays](#phase-4--modals--overlays)
7. [Phase 5 — Components & Touch Targets](#phase-5--components--touch-targets)
8. [Phase 6 — Typography, Density & Polish](#phase-6--typography-density--polish)
9. [Testing Matrix](#testing-matrix)

---

## 1. Current State Audit

### 🔴 Critical Blockers

| Issue | File | Detail |
|-------|------|--------|
| Orientation locked to `LANDSCAPE` | `app/_layout.tsx` | `ScreenOrientation.lockAsync(LANDSCAPE)` prevents portrait entirely |
| Immersive mode hides system bars | `app/_layout.tsx` | `ImmersiveMode.fullLayout(true)` + `FullSticky` — no safe-area handling |
| App shell assumes wide viewport | `app/(app)/_layout.tsx` | `flex-row` with `<IconRail>` (56 px) + content — IconRail eats 15% of a 375 px screen |
| Zero responsive breakpoints | `tailwind.config.js` | No `screens` breakpoints defined, no `useWindowDimensions` anywhere |
| No `SafeAreaView` usage | Entire app | Immersive mode side-steps the issue on tablets but phones have notches, status bars, gesture bars |

### 🔴 Breaking Layouts (screens that literally won't fit on a phone)

| Screen | File(s) | Layout | Problem on 375 px |
|--------|---------|--------|--------------------|
| **Order** | `app/(app)/order/[tableId].tsx` + `components/order/OrderPanel.tsx` + `components/menu/MenuGrid.tsx` | 30/70 `flex-row` split (menu left, order right) | Order panel gets ~112 px — unusable |
| **Checkout** | `app/(app)/checkout/[orderId].tsx` + `components/checkout/*` | 50/50 `flex-row` split with inline `style={{ flex: 1 }}` | Each panel ~187 px — buttons overflow |
| **Kitchen KDS** | `app/(app)/kitchen/index.tsx` + `components/kitchen/KOTCard.tsx` | 3-column Kanban (`flex-row` with 3 `flex-1` columns) | ~125 px per column — unreadable |

### 🟡 Moderate Issues

| Issue | Count | Detail |
|-------|-------|--------|
| Hard-coded pixel widths on modals | ~22 occurrences across 8+ files | Widths of 380–680 px, many missing `maxWidth` |
| Floor grid fixed at 3 columns | `components/floor/TableCard.tsx` usage | Needs 2-col on phone |
| Small touch targets | Various icons/buttons | Some icon buttons are 20×20 px (min should be 44 px) |
| `AppStatusBar` information density | `components/navigation/StatusBar.tsx` | Too many segments for a narrow screen |

### 🟢 Already Phone-Safe

| Screen / Component | Why |
|---------------------|-----|
| `MenuGrid` | Dynamically calculates columns from container width |
| Auth screens (login, PIN) | Centered, max-width constrained |
| Cash management | Single-column `ScrollView` |
| Shift management | Single-column layout |
| Settings | Single-column accordion |
| Device setup | Already has responsive container |

---

## Phase 0 — Foundation (Responsive Infrastructure)

> **Estimated effort:** 1–2 days  
> **Files touched:** 5–7  
> **Risk:** Low (purely additive, no UI changes yet)

### Step 0.1 — Create a responsive hook: `useLayout`

**New file:** `hooks/use-layout.ts`

```
Purpose: Single source of truth for layout decisions across the app.
Exports:
  - isPhone: boolean        (width < 768)
  - isTablet: boolean       (width >= 768)
  - isPortrait: boolean
  - isLandscape: boolean
  - screenWidth: number
  - screenHeight: number
  - columns(minWidth): number  // helper to compute grid columns

Implementation:
  - Use `useWindowDimensions()` from react-native
  - Re-renders automatically on rotation/resize
  - Memoize derived booleans
```

### Step 0.2 — Add Tailwind breakpoints

**File:** `tailwind.config.js`

Add a custom `screens` section inside `theme.extend`:

```
screens: {
  'phone':  { max: '767px' },   // phone-only styles
  'tablet': '768px',             // tablet-and-up styles
}
```

> NativeWind v4 supports responsive prefixes — `tablet:flex-row`, `phone:flex-col`, etc.

### Step 0.3 — Unlock screen orientation

**File:** `app/_layout.tsx`

- Remove `ScreenOrientation.lockAsync(LANDSCAPE)`
- Replace with conditional logic:
  - **Tablet** (shortest side ≥ 600 dp): lock to `LANDSCAPE`
  - **Phone**: allow `DEFAULT` (portrait + landscape)
- Import and use `Dimensions` or `PixelRatio` at startup for the one-time device check

### Step 0.4 — Add SafeAreaView support

**File:** `app/_layout.tsx` and `app/(app)/_layout.tsx`

- Wrap the root `<View style={{ flex: 1 }}>` with `<SafeAreaProvider>` from `react-native-safe-area-context`
- In `(app)/_layout.tsx`, use `useSafeAreaInsets()` to add dynamic padding for notches/status bars
- Conditionally keep immersive mode **only on tablets**:
  ```
  if (Platform.OS === 'android' && isTablet) {
    ImmersiveMode.fullLayout(true);
    ImmersiveMode.setBarMode('FullSticky');
  }
  ```

### Step 0.5 — Create `<ResponsiveContainer>` utility component

**New file:** `components/ui/ResponsiveContainer.tsx`

```
Props:
  - tabletLayout: 'row' | 'col'  (default 'row')
  - phoneLayout: 'col' | 'col'   (default 'col')
  - children: ReactNode

Behavior:
  - On tablet: renders flex-row with children side-by-side
  - On phone: renders flex-col, stacking children vertically
  - Passes layout context to children so they can adapt
```

---

## Phase 1 — App Shell & Navigation

> **Estimated effort:** 2–3 days  
> **Files touched:** 6–8  
> **Risk:** Medium (navigation changes affect every screen)

### Step 1.1 — Replace `IconRail` with Bottom Tab Bar on phones

**Files:**
- `app/(app)/_layout.tsx`
- `components/navigation/IconRail.tsx`
- **New:** `components/navigation/BottomTabBar.tsx`

**Plan:**
1. Create `<BottomTabBar>` component:
   - Fixed at bottom of screen, 56 px tall
   - Shows 4–5 primary nav items with icons + labels
   - "More" button opens a bottom sheet with remaining items
   - Active indicator is a filled background, not a left-bar
   - Respects safe area insets (home gesture bar on iPhone)

2. In `app/(app)/_layout.tsx`:
   - Use `useLayout()` to detect phone vs tablet
   - **Tablet:** Keep current `flex-row` with `<IconRail>` on left
   - **Phone:** Switch to `flex-col` with content area + `<BottomTabBar>` at bottom, remove `<IconRail>`

```
TABLET LAYOUT:                    PHONE LAYOUT:
┌──────────────────────┐          ┌─────────────────┐
│ StatusBar            │          │ CompactStatusBar │
├────┬─────────────────┤          ├─────────────────┤
│Rail│   Content        │          │                 │
│    │                  │          │    Content       │
│    │                  │          │                 │
│    │                  │          │                 │
└────┴─────────────────┘          ├─────────────────┤
                                  │  Bottom Tab Bar  │
                                  └─────────────────┘
```

### Step 1.2 — Make `AppStatusBar` responsive

**File:** `components/navigation/StatusBar.tsx`

**Tablet (current):**
```
[Avatar] Name [Role]    |    12:30    |    Shift: Open | 5 orders | Device · Branch
```

**Phone (new):**
```
[Avatar] Name    12:30    [Shift dot]
```

- Hide role badge, device name, branch name on phone
- Reduce height from 44 px → 36 px on phone
- Move detailed info to a "pull-down" or to the "More" sheet

### Step 1.3 — Create "More" bottom sheet for secondary nav

**New file:** `components/navigation/MoreSheet.tsx`

- Triggered by the 5th tab ("More" or "⋯") in `<BottomTabBar>`
- Contains: Kitchen, Inventory, Customers, Reservations, Reports, Cash, Settings
- Also shows: user info, lock, sign-out (currently in IconRail footer)
- Uses `@gorhom/bottom-sheet` or a simple `Modal` with slide-up animation

---

## Phase 2 — Core Workflow Screens

> **Estimated effort:** 4–6 days  
> **Files touched:** 15–20  
> **Risk:** High (these are the money-making screens — test thoroughly)

### Step 2.1 — Floor/Table View

**Files:**
- `app/(app)/floor/index.tsx`
- `components/floor/TableCard.tsx`
- `components/floor/FloorAreaTabs.tsx`

**Current layout:** Grid of table cards (3 columns on tablet)

**Changes:**
- [ ] Use `useLayout()` to set grid columns: **2 columns on phone**, 3–4 on tablet
- [ ] Reduce `TableCard` padding from `p-4` → `p-3` on phone
- [ ] Ensure `FloorAreaTabs` scrolls horizontally on phone (already `ScrollView horizontal` — verify)
- [ ] Table card dimensions: minimum 160 px wide on phone (verify with 2-col grid on 375 px = ~180 px each ✓)

**Difficulty:** 🟢 Easy — mostly grid column adjustment

### Step 2.2 — Order Screen (CRITICAL — most complex conversion)

**Files:**
- `app/(app)/order/[tableId].tsx`
- `hooks/use-order-screen.ts`
- `components/menu/MenuGrid.tsx`, `CategoryTabs.tsx`, `MenuItemCard.tsx`, `MenuSearchBar.tsx`
- `components/order/OrderPanel.tsx`, `OrderItemRow.tsx`, `OrderActions.tsx`, `OrderTotals.tsx`
- `components/menu/ModifierPicker.tsx`

**Current layout:** Side-by-side split — 30% menu | 70% order panel (flex-row)

**Phone layout — Tab-based approach:**
```
┌─────────────────────┐
│ Table #5  ·  3 items │  ← Compact header
├─────────────────────┤
│                     │
│   [Active Tab View]  │  ← Full-width content
│   Menu OR Cart       │
│                     │
├─────────────────────┤
│ [Menu] [Cart (3)]   │  ← Tab switcher
│ [Send to Kitchen]   │  ← Sticky action button
└─────────────────────┘
```

**Detailed changes:**

1. **Create `<OrderScreenPhone>` wrapper:**
   - Two tabs: "Menu" and "Cart (n)"
   - Badge on Cart tab shows item count
   - Full-width for each tab — no side-by-side split
   - Persistent bottom action bar with "Send to Kitchen" / "Checkout"

2. **Create `<OrderScreenTablet>` wrapper:**
   - Keep current side-by-side split
   - No changes needed

3. **In `app/(app)/order/[tableId].tsx`:**
   - Use `useLayout()` to pick `<OrderScreenPhone>` or `<OrderScreenTablet>`

4. **`MenuGrid` on phone:**
   - Already responsive ✓ (calculates columns from width)
   - Verify minimum card width works at 375 px (should be 2 columns)

5. **`MenuItemCard` on phone:**
   - Reduce image size if present
   - Price text: ensure it doesn't wrap

6. **`OrderPanel` on phone:**
   - Remove min-width constraints
   - `OrderItemRow`: stack quantity control below item name instead of inline
   - `OrderTotals`: full-width, reduce padding
   - `OrderActions`: stack buttons vertically if needed

7. **`ModifierPicker` on phone:**
   - Currently a modal with fixed width (~500 px)
   - Convert to full-screen modal on phone
   - Ensure scrollable if many modifiers

**Difficulty:** 🔴 Hard — needs new tab navigation pattern + significant component refactoring

### Step 2.3 — Checkout Screen

**Files:**
- `app/(app)/checkout/[orderId].tsx`
- `components/checkout/OrderSummaryPanel.tsx`
- `components/checkout/CheckoutPaymentPanel.tsx`
- `components/checkout/ViewOnlyPanel.tsx`
- `components/payment/PaymentMethodSelector.tsx`
- `components/payment/CashPayment.tsx`
- `components/payment/SplitPayment.tsx`
- `components/payment/DiscountSelector.tsx`

**Current layout:** 50/50 `flex-row` split — Order summary left | Payment right

**Phone layout — Stacked with collapsible summary:**
```
┌─────────────────────┐
│ Order #1234 ▼       │  ← Tappable to expand/collapse summary
│ 3 items · Rp 150.000│
├─────────────────────┤
│                     │
│  Payment section     │  ← Full-width
│  [QRIS] [Cash]      │
│  [Debit] [Credit]   │
│                     │
│  Amount input        │
│  Change calculation  │
│                     │
├─────────────────────┤
│ [Complete Payment]   │  ← Sticky bottom button
└─────────────────────┘
```

**Changes:**
- [ ] On phone: stack vertically (`flex-col`) — summary on top (collapsible), payment below
- [ ] `OrderSummaryPanel`: Add collapse/expand toggle on phone; show just total + item count when collapsed
- [ ] `PaymentMethodSelector`: 2×2 grid instead of horizontal row on phone
- [ ] `CashPayment` number pad: ensure it fits within phone width (verify button sizing)
- [ ] `SplitPayment`: stack each split entry vertically on phone
- [ ] `DiscountSelector`: full-width modal on phone

**Difficulty:** 🟡 Medium — stacking is straightforward, but payment flows need careful testing

### Step 2.4 — Kitchen Display (KDS)

**Files:**
- `app/(app)/kitchen/index.tsx`
- `components/kitchen/KOTCard.tsx`

**Current layout:** 3-column Kanban — Pending | Preparing | Ready

**Phone layout — Swipeable tabs:**
```
┌─────────────────────┐
│ [Pending] [Prep] [Ready] │  ← Horizontal tabs
├─────────────────────┤
│                     │
│  KOT Card            │  ← Full-width cards
│  KOT Card            │
│  KOT Card            │
│                     │
└─────────────────────┘
```

**Changes:**
- [ ] On phone: replace 3-column flex-row with swipeable `FlatList` or tab view
- [ ] Each tab shows a full-width scrollable list of KOT cards
- [ ] Badge counts on each tab header
- [ ] `KOTCard`: full-width, same content — just remove the width constraint
- [ ] On tablet: keep current 3-column Kanban layout

**Difficulty:** 🟡 Medium — tab pattern is well-established, KOTCard just needs to be full-width

---

## Phase 3 — Secondary Screens

> **Estimated effort:** 2–3 days  
> **Files touched:** 10–15  
> **Risk:** Low (most are already close to mobile-friendly)

### Step 3.1 — Daily Orders

**Files:**
- `app/(app)/daily-orders/index.tsx`
- `components/daily-orders/OrderRow.tsx`

**Current:** List view — likely already single-column

**Changes:**
- [ ] Verify `OrderRow` doesn't overflow on 375 px
- [ ] If it shows a side detail panel: collapse to tap-to-expand or navigate to detail screen
- [ ] Ensure search/filter bar wraps properly

**Difficulty:** 🟢 Easy

### Step 3.2 — Inventory

**Files:**
- `app/(app)/inventory/index.tsx`
- `components/inventory/StockTab.tsx`
- `components/inventory/PurchasesTab.tsx`
- `components/inventory/SuppliersTab.tsx`

**Current:** Tab-based with data tables

**Changes:**
- [ ] Ensure tab bar scrolls horizontally on phone
- [ ] Convert wide data tables to card-based list view on phone
- [ ] Each stock/purchase/supplier item → card with key info, tap for details
- [ ] Action buttons (add, edit): FAB (floating action button) on phone

**Difficulty:** 🟡 Medium — table-to-card conversion takes time

### Step 3.3 — Customers

**Files:**
- `app/(app)/customers/index.tsx`

**Changes:**
- [ ] If master-detail split: collapse to list → detail navigation on phone
- [ ] Search bar: full-width on phone
- [ ] Customer card: ensure it fits 375 px

**Difficulty:** 🟢 Easy

### Step 3.4 — Reservations

**Files:**
- `app/(app)/reservations/index.tsx`
- `components/floor/ReservationModal.tsx`

**Changes:**
- [ ] List view: ensure cards stack vertically
- [ ] `ReservationModal`: convert to full-screen on phone (see Phase 4)
- [ ] Date/time pickers: ensure they don't overflow

**Difficulty:** 🟢 Easy

### Step 3.5 — Settings

**Files:**
- `app/(app)/settings/index.tsx`
- `components/settings/AccordionSection.tsx`
- `components/settings/ConfigSection.tsx`
- `components/settings/DeviceList.tsx`
- `components/settings/PrinterSection.tsx`

**Current:** Single-column accordion — already phone-friendly structure

**Changes:**
- [ ] Verify `AccordionSection` doesn't use fixed widths
- [ ] `DeviceList`: ensure table/list items don't overflow
- [ ] `PrinterSection`: test connect/disconnect buttons don't overflow
- [ ] Reduce horizontal padding on phone

**Difficulty:** 🟢 Easy

### Step 3.6 — Shifts & Cash Management

**Files:**
- `app/(app)/shifts/index.tsx`
- `app/(app)/cash/index.tsx`
- `components/shift/CashTransactionList.tsx`
- `components/shift/CashTransactionModal.tsx`

**Current:** Single-column layouts — already mostly phone-safe

**Changes:**
- [ ] Verify shift summary cards don't use fixed widths
- [ ] `CashTransactionModal`: full-screen on phone
- [ ] Number input for cash amounts: ensure keypad fits

**Difficulty:** 🟢 Easy

### Step 3.7 — Menu Management

**Files:**
- `app/(app)/menu/index.tsx`
- `components/menu/CategoryTabs.tsx`
- `components/menu/MenuGrid.tsx`
- `components/menu/MenuItemCard.tsx`
- `components/menu/MenuSearchBar.tsx`

**Current:** Category tabs + grid — `MenuGrid` already responsive ✓

**Changes:**
- [ ] `CategoryTabs`: verify horizontal scroll works on narrow screen
- [ ] `MenuSearchBar`: full-width on phone
- [ ] `MenuItemCard`: verify at 2-column width on 375 px
- [ ] If menu management has edit forms: ensure inputs are full-width

**Difficulty:** 🟢 Easy (mostly already responsive)

---

## Phase 4 — Modals & Overlays

> **Estimated effort:** 2 days  
> **Files touched:** 8–12  
> **Risk:** Low-Medium

### General Modal Strategy

All modals in the app need this treatment:

| On Tablet | On Phone |
|-----------|----------|
| Centered dialog with fixed width (380–680 px) | Full-screen or bottom sheet |
| `maxWidth` + `margin: auto` | `width: '100%'`, `height: '100%'` or 85% height bottom sheet |
| Backdrop tap to dismiss | Swipe down to dismiss + close button |

### Step 4.1 — Create `<AdaptiveModal>` wrapper

**New file:** `components/ui/AdaptiveModal.tsx`

```
Props:
  - visible: boolean
  - onClose: () => void
  - title: string
  - tabletWidth?: number (default 480)
  - children: ReactNode

Behavior:
  - Phone: renders as full-screen modal with header (title + close button)
  - Tablet: renders as centered dialog with the specified width
```

### Step 4.2 — Convert existing modals

| Modal | File | Current Width | Action |
|-------|------|---------------|--------|
| `ModifierPicker` | `components/menu/ModifierPicker.tsx` | ~500 px | → `AdaptiveModal` |
| `ReservationModal` | `components/floor/ReservationModal.tsx` | ~500 px | → `AdaptiveModal` |
| `CashTransactionModal` | `components/shift/CashTransactionModal.tsx` | ~420 px | → `AdaptiveModal` |
| `DiscountSelector` | `components/payment/DiscountSelector.tsx` | ~400 px | → `AdaptiveModal` |
| `ReceiptPreview` | `components/print/ReceiptPreview.tsx` | ~380 px | → `AdaptiveModal` |
| `WeightInput` | `components/menu/WeightInput.tsx` | ~380 px | → `AdaptiveModal` |
| `KOTTicketPreview` | `components/kitchen/KOTTicketPreview.tsx` | ~480 px | → `AdaptiveModal` |

### Step 4.3 — Bottom sheets

For modals that are "pickers" or "selectors" (short content), use bottom sheet instead of full-screen on phone:

- Payment method selector
- Discount type picker
- Floor area selector
- Any confirmation dialogs

---

## Phase 5 — Components & Touch Targets

> **Estimated effort:** 1–2 days  
> **Files touched:** 10–15  
> **Risk:** Low

### Step 5.1 — Audit and fix touch targets

**Apple HIG minimum:** 44×44 pt  
**Material Design minimum:** 48×48 dp  
**Our standard:** 48 dp (already defined as `min-h-pos-touch`)

**Components to fix:**

| Component | Current Size | Fix |
|-----------|-------------|-----|
| `IconRail` nav items | `h-12` (48 px) ✓ | OK |
| `IconRail` bottom actions | `h-10` (40 px) ❌ | → `h-12` |
| `IconButton` default | Varies | Ensure `min-h-pos-touch min-w-pos-touch` |
| `StatusBar` avatar | `h-7 w-7` (28 px) | Not tappable — OK |
| Small icon buttons in lists | Some at 20×20 px ❌ | → wrap in 44 px hit area |
| `OrderItemRow` quantity +/- buttons | Check size | Ensure 44×44 minimum |
| `CategoryTabs` items | Check height | Ensure `min-h-pos-touch` |

### Step 5.2 — Button component responsive sizing

**File:** `components/ui/Button.tsx` and related

- Ensure all buttons have `min-h-pos-touch` by default
- On phone: increase vertical padding slightly for easier tapping
- Verify `PrimaryButton`, `DangerButton`, `SecondaryButton`, `SuccessButton`, `SelectButton` all inherit

### Step 5.3 — Form input sizing

- All `TextInput` fields: minimum height 48 px
- Ensure `placeholder` text is readable (not too small on phone)
- Number pads (cash payment, PIN): buttons at least 56 px on phone

---

## Phase 6 — Typography, Density & Polish

> **Estimated effort:** 1–2 days  
> **Files touched:** 5–8  
> **Risk:** Low

### Step 6.1 — Responsive font sizes

The current font scale is optimized for tablet viewing distance (~18 inches).  
On phones (~12 inches), some sizes can be slightly reduced, but readability must be maintained.

**Proposed phone overrides** (via `useLayout` or Tailwind breakpoints):

| Token | Tablet | Phone | Notes |
|-------|--------|-------|-------|
| `pos-xs` | 11 px | 11 px | Same |
| `pos-sm` | 13 px | 12 px | Slightly tighter |
| `pos-base` | 15 px | 14 px | Body text |
| `pos-lg` | 17 px | 16 px | — |
| `pos-xl` | 20 px | 18 px | — |
| `pos-2xl` | 23 px | 20 px | — |
| `pos-3xl` | 29 px | 24 px | Headers |

> **Alternative:** Keep same sizes and rely on layout changes. Test first before scaling down.

### Step 6.2 — Information density

Phone screens need less information visible at once with more progressive disclosure.

**Patterns to apply:**
- **Truncate + expand:** Long text (order notes, customer addresses) truncated with "Show more"
- **Badges instead of labels:** Replace "Status: Occupied" with a colored dot
- **Secondary info on demand:** Tap a card to reveal details instead of showing everything
- **Horizontal scroll for overflow:** Category tabs, payment methods — horizontal scroll rather than wrapping

### Step 6.3 — Animations & transitions

- Tab transitions between Menu ↔ Cart (order screen) should be smooth swipe
- Bottom sheet modals should use spring animation
- Screen transitions: use `animation: 'slide_from_right'` on phone (currently `'none'`)

### Step 6.4 — Keyboard handling

- When keyboard opens, ensure:
  - Active input is scrolled into view (`KeyboardAvoidingView` or `KeyboardAwareScrollView`)
  - Bottom tab bar hides or the content shifts up
  - Cash payment numpad doesn't conflict with system keyboard

---

## Testing Matrix

### Device Targets

| Device | Width | Height | Orientation | Priority |
|--------|-------|--------|-------------|----------|
| iPhone SE (3rd gen) | 375 | 667 | Portrait | 🔴 Must pass |
| iPhone 15 | 393 | 852 | Portrait | 🔴 Must pass |
| iPhone 15 Pro Max | 430 | 932 | Portrait | 🟡 Should pass |
| Pixel 7 | 412 | 915 | Portrait | 🔴 Must pass |
| Samsung Galaxy A14 | 384 | 854 | Portrait | 🟡 Should pass |
| iPad 10th gen | 1180 | 820 | Landscape | 🔴 Must pass (existing) |
| Android tablet 10" | 1280 | 800 | Landscape | 🔴 Must pass (existing) |
| Phone landscape | 667+ | 375 | Landscape | 🟢 Nice to have |

### Test Checklist Per Screen

For every screen, verify:

- [ ] Renders without overflow on 375 px width
- [ ] All text is readable (no truncation of critical info)
- [ ] All buttons/controls are tappable (44 px minimum)
- [ ] Scrolling works (content doesn't get cut off)
- [ ] Modals don't overflow the screen
- [ ] Keyboard doesn't cover inputs
- [ ] Navigation is accessible (can reach all functions)
- [ ] Landscape still works on tablet (regression test)
- [ ] Performance is acceptable (no layout thrashing from `useWindowDimensions`)

---

## Implementation Order (Recommended)

```
Week 1:
  ✅ Phase 0 — Foundation (hook, breakpoints, orientation, safe area)
  ✅ Phase 1 — App shell & navigation (bottom tabs, status bar)

Week 2:
  ✅ Phase 2.1 — Floor view (easy win)
  ✅ Phase 2.2 — Order screen (hardest — start early)

Week 3:
  ✅ Phase 2.3 — Checkout screen
  ✅ Phase 2.4 — Kitchen display

Week 4:
  ✅ Phase 3 — All secondary screens
  ✅ Phase 4 — All modals

Week 5:
  ✅ Phase 5 — Touch targets & component fixes
  ✅ Phase 6 — Typography, density, polish
  ✅ Full regression testing on tablet
  ✅ Full testing on phone devices
```

---

## Dependencies to Install

| Package | Purpose | Required? |
|---------|---------|-----------|
| `react-native-safe-area-context` | Safe area insets for notches/gesture bars | ✅ Yes (likely already installed) |
| `@gorhom/bottom-sheet` | Bottom sheet modals on phone | 🟡 Optional (can use `Modal` instead) |
| `react-native-pager-view` | Swipeable tabs for KDS / Order screen | 🟡 Optional (can use state-based tabs) |

---

## Files Created (New)

| File | Purpose |
|------|---------|
| `hooks/use-layout.ts` | Responsive layout hook |
| `components/navigation/BottomTabBar.tsx` | Phone bottom navigation |
| `components/navigation/MoreSheet.tsx` | Overflow nav items on phone |
| `components/ui/AdaptiveModal.tsx` | Modal that adapts to phone/tablet |
| `components/ui/ResponsiveContainer.tsx` | Layout wrapper for split → stack |
| `components/order/OrderScreenPhone.tsx` | Phone-specific order layout |
| `components/order/OrderScreenTablet.tsx` | Tablet-specific order layout (extract from current) |

## Files Modified (Major Changes)

| File | Change |
|------|--------|
| `app/_layout.tsx` | Orientation unlock, SafeAreaProvider, conditional immersive |
| `app/(app)/_layout.tsx` | Conditional IconRail vs BottomTabBar |
| `app/(app)/order/[tableId].tsx` | Phone vs tablet layout switch |
| `app/(app)/checkout/[orderId].tsx` | Stack vertically on phone |
| `app/(app)/kitchen/index.tsx` | Tabs instead of columns on phone |
| `components/navigation/StatusBar.tsx` | Compact mode on phone |
| `components/navigation/IconRail.tsx` | Hide on phone |
| `tailwind.config.js` | Add breakpoints |
| Every modal component | Wrap in `AdaptiveModal` |
