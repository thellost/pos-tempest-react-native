# POS Tempest: Utility-Industrial Redesign Plan

## Context

The current POS app uses a generic "dark SaaS dashboard" aesthetic with indigo accents, large rounded cards, excessive padding, and decorative slide animations. This is wrong for a tool used by cashiers in a high-intensity restaurant environment. Every pixel must serve a function. The redesign transforms the app into a **cockpit-mode, information-dense, utility-first** interface where order state and app status are instantly scannable.

**Design parameters:**
- Visual Density: **9/10** (Cockpit Mode) -- tight padding, `font-mono` for numbers, `divide-y` over card boxes
- Design Variance: **3/10** (Predictable) -- strict grids, no decorative elements
- Motion Intensity: **2/10** -- press feedback only, instant screen transitions

---

## Phase 1: Design System Overhaul

### Step 1.1 -- `constants/theme.ts`

**Goal:** Replace all indigo with Electric Blue, tighten radii and spacing.

**Color replacements (find/replace all instances):**

```
ThemeColors.accent:
  primary:         '#6366F1'  -->  '#0EA5E9'
  primaryHover:    '#818CF8'  -->  '#38BDF8'
  primaryPress:    '#4F46E5'  -->  '#0284C7'
  primaryMuted:    'rgba(99, 102, 241, 0.15)'  -->  'rgba(14, 165, 233, 0.15)'
  primaryGlow:     'rgba(99, 102, 241, 0.25)'  -->  'rgba(14, 165, 233, 0.25)'
  primarySubtle:   'rgba(99, 102, 241, 0.10)'  -->  'rgba(14, 165, 233, 0.10)'
  primaryLight:    'rgba(99, 102, 241, 0.12)'  -->  'rgba(14, 165, 233, 0.12)'
  primaryBadge:    'rgba(99, 102, 241, 0.22)'  -->  'rgba(14, 165, 233, 0.22)'
  primaryDisabled: 'rgba(99, 102, 241, 0.20)'  -->  'rgba(14, 165, 233, 0.20)'
  primaryBorder:   'rgba(99, 102, 241, 0.30)'  -->  'rgba(14, 165, 233, 0.30)'

ThemeColors.borders:
  focus: '#6366F1'  -->  '#0EA5E9'

Brand:
  primary:      '#6366F1'  -->  '#0EA5E9'
  primaryHover: '#818CF8'  -->  '#38BDF8'
  primaryPress: '#4F46E5'  -->  '#0284C7'

shadows.glow:
  shadowColor: ThemeColors.accent.primary  (auto-updates)
```

**Apply identical changes to `LightThemeColors.accent.*` and `LightThemeColors.borders.focus`.**

**Border radius reduction:**

```ts
export const BorderRadius = {
  none: 0,
  sm: 4,    // was 6
  md: 6,    // was 10
  lg: 8,    // was 14
  xl: 12,   // was 20
  '2xl': 16, // was 24
  full: 9999,
} as const;
```

**Add ultra-tight spacing:**

```ts
export const Spacing = {
  '2xs': 2,  // NEW
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;
```

---

### Step 1.2 -- `tailwind.config.js`

**Goal:** Update Tailwind tokens for colors, font sizes, radii, spacing, and add monospace font.

**Color changes:**

```js
brand: {
  DEFAULT: "#0EA5E9",  // was #6366F1
  hover: "#38BDF8",    // was #818CF8
  press: "#0284C7",    // was #4F46E5
},
accent: {
  DEFAULT: "#0EA5E9",
  hover: "#38BDF8",
  press: "#0284C7",
  muted: "rgba(14, 165, 233, 0.15)",
  glow: "rgba(14, 165, 233, 0.25)",
},
border: {
  // ... keep existing
  focus: "#0EA5E9",  // was #6366F1
},
category: {
  // ... keep existing
  specials: "#14B8A6",  // was #8B5CF6 (purple -> teal, avoids accent collision)
},
```

**Font size reduction (~15% smaller):**

```js
fontSize: {
  "pos-xs":   ["10px", "14px"],   // was ["11px", "16px"]
  "pos-sm":   ["11px", "16px"],   // was ["13px", "18px"]
  "pos-base": ["13px", "18px"],   // was ["15px", "22px"]
  "pos-lg":   ["15px", "20px"],   // was ["17px", "24px"]
  "pos-xl":   ["17px", "24px"],   // was ["20px", "28px"]
  "pos-2xl":  ["20px", "28px"],   // was ["24px", "32px"]
  "pos-3xl":  ["26px", "34px"],   // was ["30px", "38px"]
},
```

**Border radius tightening:**

```js
borderRadius: {
  sm: "4px",    // was 6px
  md: "6px",    // was 10px
  lg: "8px",    // was 14px
  xl: "12px",   // was 20px
  "2xl": "16px", // was 24px
  card: "8px",  // was 16px
},
```

**Font family -- Geist Sans + Geist Mono:**

```js
fontFamily: {
  sans: ['Geist', 'System'],
  mono: ['Geist Mono', 'monospace'],
},
spacing: {
  "pos-2xs": "2px",  // NEW
  // keep all existing pos-xs through pos-3xl
},
boxShadow: {
  // ... keep sm, md, lg
  glow: "0 0 12px rgba(14, 165, 233, 0.3)",             // was indigo
  "glow-success": "0 0 12px rgba(16, 185, 129, 0.3)",   // keep
  "glow-danger": "0 0 12px rgba(239, 68, 68, 0.3)",     // keep
},
```

---

### Step 1.3 -- `hooks/use-app-theme.tsx`

**No color changes needed.** CSS variables only store neutral surface/border/text values, not accent colors.

---

### Step 1.4 -- Font Loading in `app/_layout.tsx`

**Goal:** Load Geist Sans (primary UI font) and Geist Mono (numerical data) via `expo-font`.

**Why Geist:** Designed specifically for software interfaces by Vercel. Clean, highly legible at small sizes (10-13px), tight metrics for information density, excellent weight range (400-700). Pairs naturally with Geist Mono for a cohesive utility aesthetic. No-nonsense, tool-grade typography.

**Step 1:** Download font files to `assets/fonts/`:
- `Geist-Regular.ttf` (400)
- `Geist-Medium.ttf` (500)
- `Geist-SemiBold.ttf` (600)
- `Geist-Bold.ttf` (700)
- `GeistMono-Regular.ttf` (400)
- `GeistMono-Bold.ttf` (700)

Source: https://github.com/vercel/geist-font (OFL license, free for commercial use)

**Step 2:** Add to root layout:

```tsx
import { useFonts } from 'expo-font';

// Inside component, before other hooks:
const [fontsLoaded] = useFonts({
  'Geist':          require('@/assets/fonts/Geist-Regular.ttf'),
  'Geist-Medium':   require('@/assets/fonts/Geist-Medium.ttf'),
  'Geist-SemiBold': require('@/assets/fonts/Geist-SemiBold.ttf'),
  'Geist-Bold':     require('@/assets/fonts/Geist-Bold.ttf'),
  'Geist Mono':     require('@/assets/fonts/GeistMono-Regular.ttf'),
  'Geist Mono Bold': require('@/assets/fonts/GeistMono-Bold.ttf'),
});

// Gate rendering until fonts are loaded (before existing loading checks):
if (!fontsLoaded) {
  return null; // or SplashScreen.preventAutoHideAsync()
}
```

**Step 3:** Set Geist as the default app font. In NativeWind, apply `font-sans` as the base class on the root `<View>` in `app/_layout.tsx`:

```tsx
<View style={themeVars} className="flex-1 font-sans">
```

This makes all `<Text>` descendants inherit Geist unless overridden by `font-mono`.

**Tailwind usage throughout components:**
- Default (labels, headings, body): inherits `font-sans` (Geist) -- no class needed
- Numerical data (prices, quantities, times, IDs): explicit `font-mono` (Geist Mono)
- Font weights map: `font-medium` -> Geist-Medium, `font-semibold` -> Geist-SemiBold, `font-bold` -> Geist-Bold

---

## Phase 2: Navigation Restructure

### Step 2.1 -- Create `constants/navigation.ts` (new file)

**Goal:** Extract nav item arrays from `SideDrawer.tsx` to a shared location.

```tsx
import {
  BarChart2, Banknote, CalendarDays, ChefHat, DollarSign,
  LayoutGrid, Package, Settings, Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  roles?: string[];
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Tables & Orders', icon: LayoutGrid,   href: '/(app)/floor' },
  { label: 'Reservations',    icon: CalendarDays,  href: '/(app)/reservations' },
  { label: 'Kitchen Display', icon: ChefHat,       href: '/(app)/kitchen' },
  { label: 'Inventory',       icon: Package,       href: '/(app)/inventory' },
  { label: 'Customers',       icon: Users,         href: '/(app)/customers' },
  { label: 'Reports',         icon: BarChart2,     href: '/(app)/reports', roles: ['admin', 'manager'] },
];

export const SYSTEM_NAV: NavItem[] = [
  { label: 'Shift',    icon: DollarSign, href: '/(app)/shifts' },
  { label: 'Cash',     icon: Banknote,   href: '/(app)/cash' },
  { label: 'Settings', icon: Settings,   href: '/(app)/settings' },
];
```

---

### Step 2.2 -- Create `components/navigation/IconRail.tsx` (new file)

**Goal:** Persistent vertical icon navigation, always visible. Replaces hamburger + drawer.

```
Layout:
  w-14 (56px) bg-surface-card border-r border-border

  TOP SECTION (flex-1):
    For each navItem in MAIN_NAV + SYSTEM_NAV:
      <Pressable h-12 w-full items-center justify-center>
        <Icon size={20} color={isActive ? accent : muted} />
        {isActive && <View absolute left-0 w-0.5 h-6 bg-accent rounded-r-full />}
      </Pressable>

  BOTTOM SECTION:
    <Pressable> User avatar (initials circle, h-8 w-8) </Pressable>
    <Pressable> <Lock size={18} /> </Pressable>
    <Pressable> <LogOut size={18} /> </Pressable>
```

Props: `navItems`, `currentPath`, `onNavigate`, `user`, `onLock`, `onSignOut`, `userRole`

Active state: 2px left border in accent color + icon tinted accent. All other icons in `ThemeColors.text.muted`.

Touch targets: each item is `h-12 w-14` = 48x56px (meets pos-touch requirement).

Filter nav items by `item.roles` against `userRole`. Show Cash item only when shift is open (pass `isShiftOpen` prop).

---

### Step 2.3 -- Create `components/navigation/StatusBar.tsx` (new file)

**Goal:** Thin top bar showing real-time app state at a glance.

```
Layout:
  h-8 (32px) flex-row items-center bg-surface-card border-b border-border px-3

  LEFT:
    User initials badge (h-5 w-5 rounded-full bg-accent text-[8px])
    User name (text-pos-xs)
    Role pill (text-[8px] uppercase bg-accent-muted px-1.5 rounded)

  CENTER (flex-1, items-center):
    Current time in font-mono (HH:MM format, updates every 60s via useEffect interval)

  RIGHT:
    Shift status dot (h-2 w-2 rounded-full, green if open, red if closed)
    "Shift: Open" or "No Shift" (text-pos-xs)
    Separator (| in text-border)
    Active orders count (font-mono font-bold)
    Device name (text-pos-xs text-pos-text-faint)
    Branch name (text-pos-xs text-pos-text-faint)
```

Props: `user`, `isShiftOpen`, `activeOrdersCount`, `deviceName`, `branchName`

Time update: `useEffect` with `setInterval(60000)` updating `useState<string>` formatted via `toLocaleTimeString`.

---

### Step 2.4 -- Restructure `app/(app)/_layout.tsx`

**Current structure (lines 141-239):**
```tsx
<View className="flex-1 flex-row">
  <View className="w-14 ...">           // hamburger rail
    <HamburgerButton />
  </View>
  <View className="flex-1">             // content
    <Stack animation="slide_from_right" />
    {/* absolute branch badge */}
  </View>
  <SideDrawer isOpen={drawerOpen} ... />
</View>
```

**New structure:**
```tsx
<View className="flex-1 flex-col">
  {/* TOP STATUS BAR */}
  <StatusBar
    user={user}
    isShiftOpen={isShiftOpen}
    activeOrdersCount={occupiedTablesCount}  // from useTables or a lightweight query
    deviceName={registration?.device?.device_name ?? ''}
    branchName={registration?.branch?.name ?? ''}
  />

  <View className="flex-1 flex-row">
    {/* PERSISTENT ICON RAIL */}
    <IconRail
      navItems={[...MAIN_NAV, ...SYSTEM_NAV]}
      currentPath={pathname}
      onNavigate={(href) => router.push(href)}
      user={user}
      userRole={user?.role_name?.toLowerCase() ?? ''}
      isShiftOpen={isShiftOpen}
      onLock={lock}
      onSignOut={signOut}
    />

    {/* MAIN CONTENT */}
    <View className="flex-1" onTouchStart={markActivity} ...>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        {/* all existing Stack.Screen entries stay */}
      </Stack>
    </View>
  </View>
</View>
```

**Remove:**
- `const [drawerOpen, setDrawerOpen] = useState(false);` (line 23)
- `<HamburgerButton>` render (line 145)
- `<SideDrawer>` render (lines 225-237)
- Absolute branch/device badge (lines 215-221)
- `import { HamburgerButton }` and `import { SideDrawer }`
- Change `animation: 'slide_from_right'` to `animation: 'none'` (line 158)

**Add imports:**
```tsx
import { IconRail } from '@/components/navigation/IconRail';
import { StatusBar } from '@/components/navigation/StatusBar';
import { MAIN_NAV, SYSTEM_NAV } from '@/constants/navigation';
```

---

### Step 2.5 -- Deprecate `components/navigation/SideDrawer.tsx`

Keep the file but add a `@deprecated` comment. It can be deleted later once IconRail is verified working. The nav item arrays have been extracted to `constants/navigation.ts`.

---

### Step 2.6 -- Deprecate `components/navigation/HamburgerButton.tsx`

Same as above. Keep file, add `@deprecated`, delete later.

---

## Phase 3: Component Density Upgrades

### Step 3.1 -- `components/ui/Button.tsx` (line 19)

```
BEFORE: pressScale = 0.98
AFTER:  pressScale = 0.97
```

Single line change at line 19.

---

### Step 3.2 -- `components/ui/PrimaryButton.tsx` (line 14)

```
BEFORE: size === 'lg' ? 'h-12' : 'h-10'
AFTER:  size === 'lg' ? 'h-10' : 'h-9'
```

Colors auto-update from Tailwind `accent`/`border-accent` tokens.

---

### Step 3.3 -- `components/ui/SecondaryButton.tsx` (line 14)

```
BEFORE: size === 'lg' ? 'h-12' : 'h-10'
AFTER:  size === 'lg' ? 'h-10' : 'h-9'
```

---

### Step 3.4 -- `components/ui/DangerButton.tsx` (line 14)

```
BEFORE: size === 'lg' ? 'h-12' : 'h-10'
AFTER:  size === 'lg' ? 'h-10' : 'h-9'
```

---

### Step 3.5 -- `components/ui/SuccessButton.tsx` (line 14)

```
BEFORE: size === 'lg' ? 'h-12' : 'h-10'
AFTER:  size === 'lg' ? 'h-10' : 'h-9'
```

---

### Step 3.6 -- `components/ui/IconButton.tsx` (lines 10-13)

```
BEFORE:
  sm: 'h-5 w-5 items-center justify-center rounded-sm',
  md: 'h-8 w-8 items-center justify-center rounded-lg',
  lg: 'h-10 w-10 items-center justify-center rounded-lg',

AFTER:
  sm: 'h-5 w-5 items-center justify-center rounded-sm',
  md: 'h-7 w-7 items-center justify-center rounded-sm',
  lg: 'h-10 w-10 items-center justify-center rounded-sm',
```

Changed: `md` size h-8/w-8 to h-7/w-7, all `rounded-lg` to `rounded-sm`.

---

### Step 3.7 -- `components/ui/SelectButton.tsx` (line 24)

```
BEFORE: 'items-center justify-center rounded-xl border px-4 py-2'
AFTER:  'items-center justify-center rounded-sm border px-3 py-1.5'
```

---

### Step 3.8 -- `components/floor/TableCard.tsx` (MAJOR)

**Current (lines 55-133):** `min-h-[130px] rounded-2xl border-2 p-5` with 3-section layout.

**New design -- complete rewrite of the return JSX:**

```tsx
return (
  <Pressable
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={400}
    disabled={isMaintenance}
    className={`overflow-hidden rounded-sm border ${statusBgColor} ${
      isMaintenance ? 'opacity-50' : ''
    }`}
  >
    {/* Row 1: Table number + capacity + status badge */}
    <View className="flex-row items-center justify-between px-3 py-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-pos-lg font-bold font-mono text-pos-text">
          {table.table_number}
        </Text>
        <Text className="text-pos-xs text-pos-text-faint">
          ({table.capacity})
        </Text>
      </View>
      <View className={`rounded px-2 py-0.5 ${badgeBgColor}`}>
        <Text className="text-[9px] font-bold text-white">
          {statusText}
        </Text>
      </View>
    </View>

    {/* Row 2: Order info + elapsed time */}
    <View className="flex-row items-center justify-between border-t border-border/50 px-3 py-1.5">
      {isOccupied && table.active_order_id ? (
        <>
          <Text className="text-pos-xs font-mono text-pos-text-muted" numberOfLines={1}>
            {table.active_order_number}
          </Text>
          {elapsedMinutes > 0 && (
            <Text
              className={`text-pos-xs font-mono font-bold ${
                elapsedMinutes > 90
                  ? 'text-pos-danger'
                  : elapsedMinutes > 60
                  ? 'text-pos-warning'
                  : 'text-pos-text-muted'
              }`}
            >
              {elapsedMinutes >= 60
                ? `${Math.floor(elapsedMinutes / 60)}h${elapsedMinutes % 60}m`
                : `${elapsedMinutes}m`}
            </Text>
          )}
        </>
      ) : isReserved ? (
        <View className="flex-row items-center gap-1.5">
          {reservationName && (
            <Text className="text-pos-xs font-semibold text-pos-warning" numberOfLines={1}>
              {reservationName}
            </Text>
          )}
          {reservationTime && (
            <Text className="text-pos-xs font-mono text-pos-text-muted">{reservationTime}</Text>
          )}
        </View>
      ) : isMaintenance ? (
        <Text className="text-pos-xs text-pos-text-faint">Maintenance</Text>
      ) : (
        <Text className="text-pos-xs font-medium text-pos-success">+ New Order</Text>
      )}
    </View>
  </Pressable>
);
```

**Key changes:**
- Removed `min-h-[130px]` -- card is now ~60-70px (content-determined)
- `rounded-2xl` -> `rounded-sm` (4px)
- `border-2` -> `border` (1px)
- `p-5` -> `px-3 py-2` (top row) + `px-3 py-1.5` (bottom row)
- Table number: `text-pos-2xl` -> `text-pos-lg font-mono`
- Capacity: inline `(4)` instead of "Capacity: 4 people"
- Status badge: `px-3 py-1.5` -> `px-2 py-0.5`, `text-pos-xs` -> `text-[9px]`
- Elapsed time: `font-mono font-bold`, always visible in bottom row
- Order number: `font-mono`
- Removed `Shadows.md` import usage (line 58)
- Removed `mb-4` gap in old row 1, `mb-3` in old row 2
- Removed `min-h-[40px] border-t border-border pt-3` bottom section wrapper

---

### Step 3.9 -- `components/floor/FloorAreaTabs.tsx`

**Line 32:** `px-4 py-3` -> `px-3 py-2`
**Line 46:** `mr-2 rounded-xl px-5 py-3` -> `mr-1.5 rounded-sm px-3 py-2`
**Line 54:** `text-pos-base` -> `text-pos-sm`
**Line 69:** `mr-2 flex-row items-center rounded-xl px-5 py-3` -> `mr-1.5 flex-row items-center rounded-sm px-3 py-2`
**Line 79:** `text-pos-base` -> `text-pos-sm`
**Line 87:** takeaway count badge: keep current sizing

---

### Step 3.10 -- `components/order/OrderPanel.tsx`

**Line 245:** `px-4 py-3` -> `px-3 py-2`
**Line 248:** `text-pos-lg` -> `text-pos-base`, add `font-mono` for order number
**Line 281:** `mt-3` -> `mt-2` (guest counter)
**Line 290:** guest count number: add `font-mono`
**Line 319:** `contentContainerStyle={{ paddingVertical: 12 }}` -> `{{ paddingVertical: 6 }}`
**Line 323:** empty state `py-12` -> `py-6`
**Line 324:** empty state icon container `mb-3 h-12 w-12` -> `mb-2 h-10 w-10`
**Line 344:** draft total: add `font-mono` to price Text

---

### Step 3.11 -- `components/order/OrderItemRow.tsx`

**Line 57:** right action panel `w-[72px]` -> `w-[60px]`
**Line 64:** left action panel `w-[72px]` -> `w-[60px]`
**Line 86:** `mb-1.5 overflow-hidden rounded-sm bg-surface-card px-2.5 py-2` -> `mb-1 overflow-hidden rounded-sm bg-surface-card px-2 py-1.5`
**Line 117:** quantity display: add `font-mono` -> `text-center text-[11px] font-semibold font-mono text-pos-text`
**Line 140:** price display: add `font-mono` -> `text-pos-sm font-bold font-mono text-accent`

---

### Step 3.12 -- `components/order/OrderTotals.tsx`

**Line 16:** `rounded-sm bg-surface-card p-2` -> `rounded-sm bg-surface-card p-1.5`
**Lines 20, 28, 35, 42, 53:** All price `<Text>` elements: add `font-mono` class
**Line 60:** Total amount `text-pos-lg` -> `text-pos-base`, add `font-mono`

---

### Step 3.13 -- `components/order/OrderActions.tsx`

**Lines 83, 96, 122, 188, 207:** All action wrappers `p-2` -> `p-1.5`
**Lines 97, 160:** `gap-1.5` -> `gap-1`
**Line 111, 160:** `mt-1.5` -> `mt-1`

---

### Step 3.14 -- `components/menu/MenuItemCard.tsx`

**Line 49:** `style={{ minHeight: 100 }}` -> `style={{ minHeight: 76 }}`
**Line 51:** left color bar `w-1` -> `w-0.5`
**Line 56:** pressable content `px-3 pb-1.5 pt-2` -> `px-2 pb-1 pt-1.5`
**Line 63:** item name `text-[13px]` -> `text-[12px]`
**Line 67:** price text: add `font-mono` -> `text-[12px] font-semibold font-mono text-pos-text`
**Line 74:** bottom row `px-2 py-1.5` -> `px-1.5 py-1`
**Line 84:** quantity display: add `font-mono` -> `w-4 text-center text-[12px] font-semibold font-mono text-pos-text`

---

### Step 3.15 -- `components/menu/CategoryTabs.tsx`

**Line 49:** parent categories `py-3` -> `py-2`
**Line 119:** parent container `gap-2 px-4 py-3` -> `gap-1.5 px-3 py-2`
**Line 126:** sub-categories row `gap-2 border-t border-border px-4 py-2` -> `gap-1.5 border-t border-border px-3 py-1.5`
**Lines 72, 91:** sub-category items `px-3 py-2` -> `px-2 py-1.5`

---

### Step 3.16 -- `components/menu/MenuSearchBar.tsx`

**Line 28:** `rounded-lg bg-surface-elevated px-3 py-2 mx-4 my-2` -> `rounded-sm bg-surface-elevated px-3 py-1.5 mx-3 my-1.5`
**Line 36:** input text `text-pos-base` -> `text-pos-sm`

---

### Step 3.17 -- `components/kitchen/KOTCard.tsx`

**Line 111:** `mb-3 overflow-hidden rounded-xl` -> `mb-2 overflow-hidden rounded-sm`
**Line 120:** header `px-3 py-2` -> `px-2 py-1.5`
**Line 128:** ticket number: add `font-mono` -> `text-pos-xs font-bold font-mono text-pos-text-strong`
**Line 169:** elapsed time: add `font-mono` -> `text-[10px] font-semibold font-mono`
**Line 178:** table/order section `px-3 pt-2` -> `px-2 pt-1.5`
**Line 182:** order number: add `font-mono` -> `text-pos-xs font-mono text-pos-text-muted`
**Line 186:** items section `px-3 py-2` -> `px-2 py-1.5`
**Line 207:** quantity: add `font-mono` -> `text-pos-sm font-extrabold font-mono text-pos-text-strong`
**Line 245:** advance button `mx-3 mb-3 ... rounded-lg py-2` -> `mx-2 mb-2 ... rounded-sm py-1.5`

---

### Step 3.18 -- `components/kitchen/KOTTicketPreview.tsx` and `components/print/ReceiptPreview.tsx`

**No changes.** These simulate thermal paper receipts with their own monospace styling. The redesign does not affect print previews.

---

## Phase 4: Screen-Level Layout

### Step 4.1 -- `app/(app)/floor/index.tsx`

**Line 164:** Header `px-5 py-5` -> `px-3 py-2`
**Line 166:** Title `text-pos-2xl` -> `text-pos-xl`
**Line 169:** Takeaway button `rounded-lg bg-amber-500 px-5 py-3` -> `rounded-sm bg-amber-500 px-3 py-2`
**Line 172:** Takeaway button text `text-pos-base` -> `text-pos-sm`
**Line 175:** Stats row `mt-4 flex-row items-center gap-3` -> `mt-2 flex-row items-center gap-2`

**Lines 176-201:** Stat cards -- each one:
```
BEFORE: w-28 rounded-lg bg-xxx px-4 py-2 items-center
AFTER:  w-24 rounded-sm bg-xxx px-2 py-1.5 items-center
```

**Lines 181, 188, 195, 199:** Stat numbers: add `font-mono`
```
BEFORE: text-pos-xl font-bold text-status-xxx text-center
AFTER:  text-pos-xl font-bold font-mono text-status-xxx text-center
```

**Line 215:** ScrollView `contentContainerStyle={{ padding: 16 }}` -> `{{ padding: 8 }}`
**Line 232, 275:** Flex wrap gap `gap-4` -> `gap-2`
**Line 237, 277:** Card width `w-[31%]` -> `w-[24%]` (4 columns instead of 3)
**Line 237:** Takeaway card `rounded-lg bg-surface-card p-4` -> `rounded-sm bg-surface-card p-2`
**Line 242:** Takeaway order number `text-pos-lg` -> `text-pos-base`, add `font-mono`
**Line 255:** Takeaway price: add `font-mono`

---

### Step 4.2 -- `app/(app)/kitchen/index.tsx`

**Line 119:** Top bar `px-5 py-3` -> `px-3 py-2`
**Line 123:** Title `text-pos-2xl` -> `text-pos-xl`
**Line 22:** ColumnHeader `px-4 py-3` -> `px-3 py-2`
**Line 65:** Column ScrollView `contentContainerStyle={{ padding: 12 }}` -> `{{ padding: 8 }}`
**Line 69:** Empty state `py-10` -> `py-6`
**Line 71:** Empty state icon `size={28}` -> `size={22}`
**Line 127:** Active count badge number: add `font-mono`
**Line 33:** Column count number: add `font-mono`

---

### Step 4.3 -- `app/(app)/reservations/index.tsx`

- Tighten header padding: `px-5 py-5` -> `px-3 py-2`
- Title: `text-pos-2xl` -> `text-pos-xl`
- Reservation time displays: add `font-mono`
- Row padding: reduce by ~30%
- Date/time badges: `rounded-lg` -> `rounded-sm`

---

### Step 4.4 -- All remaining screens

Apply the same pattern to `customers`, `inventory`, `shifts`, `cash`, `checkout`, `reports`, `settings`:
- Header padding: `px-5 py-5` -> `px-3 py-2`
- Section titles: `text-pos-2xl` -> `text-pos-xl`
- Card border-radius: any `rounded-xl`, `rounded-2xl`, `rounded-lg` -> `rounded-sm`
- Numerical data: add `font-mono` to prices, counts, timestamps, IDs
- Inner padding on cards/sections: reduce by ~30%
- Remove any decorative shadows or glows

---

## Phase 5: Animation Removal

### Step 5.1 -- `app/(app)/_layout.tsx` (already done in Step 2.4)

```
BEFORE: animation: 'slide_from_right'
AFTER:  animation: 'none'
```

### Step 5.2 -- `components/navigation/SideDrawer.tsx` (if kept)

Replace spring animation:
```
BEFORE: Animated.spring(translateX, { damping: 20, stiffness: 180, ... })
AFTER:  Animated.timing(translateX, { duration: 100, useNativeDriver: true })
```

### Step 5.3 -- `components/ui/Button.tsx` (already done in Step 3.1)

```
BEFORE: pressScale = 0.98
AFTER:  pressScale = 0.97
```

---

## Implementation Sequence

| Step | Files | Risk | Notes |
|------|-------|------|-------|
| 1.1 | `constants/theme.ts` | Medium | All `ThemeColors.accent.*` consumers affected |
| 1.2 | `tailwind.config.js` | Medium | Every component's styling updates. Test immediately |
| 1.4 | `app/_layout.tsx` | Low | Font loading addition |
| 2.1 | `constants/navigation.ts` (new) | Low | Pure data extraction |
| 2.2 | `components/navigation/IconRail.tsx` (new) | Medium | New component |
| 2.3 | `components/navigation/StatusBar.tsx` (new) | Medium | New component |
| 2.4 | `app/(app)/_layout.tsx` | **High** | Navigation restructure, most impactful |
| 3.1-3.7 | `components/ui/*.tsx` (7 files) | Low | Small prop/class changes |
| 3.8 | `components/floor/TableCard.tsx` | Medium | Major JSX rewrite |
| 3.9 | `components/floor/FloorAreaTabs.tsx` | Low | Padding/radius changes |
| 3.10 | `components/order/OrderPanel.tsx` | Low | Padding + font-mono |
| 3.11 | `components/order/OrderItemRow.tsx` | Low | Padding + font-mono |
| 3.12 | `components/order/OrderTotals.tsx` | Low | Padding + font-mono |
| 3.13 | `components/order/OrderActions.tsx` | Low | Padding reduction |
| 3.14 | `components/menu/MenuItemCard.tsx` | Low | Height + font-mono |
| 3.15 | `components/menu/CategoryTabs.tsx` | Low | Padding reduction |
| 3.16 | `components/menu/MenuSearchBar.tsx` | Low | Radius + padding |
| 3.17 | `components/kitchen/KOTCard.tsx` | Low | Density + font-mono |
| 4.1 | `app/(app)/floor/index.tsx` | Medium | Layout + 4-col grid |
| 4.2 | `app/(app)/kitchen/index.tsx` | Low | Padding reduction |
| 4.3-4.4 | Remaining screens | Low | Pattern application |

---

## Verification Checklist

### After Phase 1:
- [ ] No indigo/purple (`#6366F1`, `#818CF8`, `#4F46E5`) visible anywhere
- [ ] All accent-colored elements render as Electric Blue (`#0EA5E9`)
- [ ] Font sizes visibly tighter across all screens
- [ ] Border radii sharper (no large rounded corners)
- [ ] Light and dark theme both work correctly

### After Phase 2:
- [ ] Icon rail shows all nav destinations with correct icons
- [ ] Active route highlighted with accent border + tinted icon
- [ ] All routes reachable by tapping icon rail items
- [ ] Status bar shows: user, time (updating), shift status, device/branch
- [ ] Touch targets on icon rail >= 48px
- [ ] No hamburger button or drawer visible
- [ ] Screen transitions are instant (no slide animation)

### After Phase 3:
- [ ] Table cards height ~60-70px (was ~130px)
- [ ] More order items visible in OrderPanel without scrolling
- [ ] Menu grid shows more items per viewport
- [ ] All prices display in monospace font
- [ ] All quantities display in monospace font
- [ ] All timestamps/elapsed times display in monospace font
- [ ] All order numbers display in monospace font
- [ ] No touch targets below 48px minimum
- [ ] Swipeable gestures still work on OrderItemRow

### After Phase 4:
- [ ] Floor view shows 4 table columns (was 3)
- [ ] Kitchen kanban shows more KOT cards per column
- [ ] Stat counters on floor view render with monospace numbers
- [ ] Grid gaps tighter, content padding reduced

### After Phase 5:
- [ ] No visible slide animation between screens
- [ ] Button press gives subtle 0.97 scale feedback
- [ ] No spring/bounce animations anywhere

### Cross-cutting:
- [ ] Dark theme works correctly
- [ ] Light theme works correctly
- [ ] No text truncation from smaller font sizes
- [ ] Test on actual tablet in landscape orientation
- [ ] Thermal paper previews (KOT/Receipt) unchanged
- [ ] All existing functionality preserved (orders, kitchen, payments, etc.)

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Electric Blue `#0EA5E9` over Emerald/Amber | Emerald conflicts with success/available status. Amber conflicts with warning/reserved. Blue is distinct from all 4 status colors. |
| Icon rail over hamburger drawer | Instant access, zero animation delay. Standard pattern for professional tools (VS Code, Figma, industrial panels). |
| `font-mono` for numbers only | Labels stay sans-serif for readability. Monospace numbers enable column alignment and rapid scanning of prices, quantities, times. |
| No nav/screen animations | 200ms animation x hundreds of daily interactions = real productivity cost. Instant transitions are a feature in high-intensity POS. |
| 4-column table grid (was 3) | With smaller cards (~60px vs 130px), 4 columns fit comfortably on landscape tablet. More tables visible = faster table scanning. |
| Keep dark/light theme support | Both themes update in parallel via CSS variables. Surface/border/text vars are neutral grays, unaffected by accent color change. |
| Keep thermal print previews unchanged | KOTTicketPreview and ReceiptPreview simulate physical receipts. They have their own amber/monospace styling that shouldn't match the app UI. |
