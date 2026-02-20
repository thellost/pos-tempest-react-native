# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

This is a **React Native POS (Point of Sale) application** built with:
- **Expo** (v54) with Expo Router for navigation
- **NativeWind** (Tailwind CSS for React Native) for styling
- **PowerSync** for local-first database with cloud sync
- **Supabase** for backend authentication and data
- **TypeScript** with strict mode enabled

## Development Roadmap

**IMPORTANT:** Before making any significant changes, read the development plan at:
```
.github/prompts/plan-posTempestRoadmap.prompt.md
```

This 14-step roadmap covers:
1. Project Structure & NativeWind Setup
2. PowerSync Schema & Data Layer
3. Auth & Session Management (email + PIN)
4. Device Registration & Management
5. Shift Management (Device-Scoped)
6. Floor & Table Management
7. Menu Display & Order Creation
8. Kitchen Order Tickets (KOT) & Kitchen Display
9. Bluetooth Printer Integration (ESC/POS)
10. Payment & Checkout
11. Customer & Reservation Management
12. Inventory Management
13. Reports & Analytics
14. Polish, Guards & Edge Cases

**Key Architecture Decisions:**
- **Shifts scoped to devices, not users** — cash drawer persists when users switch on same terminal
- **Branch locked per device** — each tablet is registered to a branch on first launch
- **Toast POS-inspired UI** — dark theme, large touch targets (48dp), grid-based menu, split-panel order view
- **Offline-first** — PowerSync enables full offline operation with background sync
- **Email + PIN auth** — Supabase handles email, PIN validated locally for offline quick-unlock

## Build/Lint/Test Commands

```bash
# Start development server
npm start

# Run on specific platforms
npm run android    # Android
npm run ios        # iOS
npm run web        # Web

# Linting
npm run lint       # Run ESLint (uses eslint-config-expo)

# Type checking (run manually)
npx tsc --noEmit
```

**Note:** No test framework is currently configured. If tests are added, prefer Jest with React Native Testing Library.

## Project Structure

```
app/                    # Expo Router file-based routes
  (app)/                # Authenticated app routes (floor, order, settings)
  (auth)/               # Login, PIN screens
  (tabs)/               # Tab navigation screens
  _layout.tsx           # Root layout with providers
components/             # Reusable UI components
  floor/                # Floor/table management components
  menu/                 # Menu display components (CategoryTabs, MenuGrid, etc.)
  order/                # Order panel components
  ui/                   # Generic UI components (icons, collapsible, etc.)
hooks/                  # Custom React hooks (use-menu, use-tables, use-auth, etc.)
services/               # Business logic services (order.service, shift.service, etc.)
lib/                    # Third-party configurations (supabase, powersync, security)
db/                     # Database layer
  models/               # TypeScript interfaces for database entities
  schema.ts             # PowerSync schema definitions
  provider.tsx          # PowerSync database provider
  connector.ts          # PowerSync sync connector
constants/              # App constants (enums, theme, config)
utils/                  # Utility functions (currency, date, order-number)
```

## Code Style Guidelines

### Imports

Order imports in groups, separated by blank lines:
1. React/React Native imports
2. Third-party packages (expo, supabase, etc.)
3. Internal imports using `@/` path alias

```typescript
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';

import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@powersync/react';

import { ORDER_STATUS } from '@/constants/enums';
import type { Order, OrderItem } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { createOrder } from '@/services/order.service';
```

### Path Aliases

Use `@/` for all internal imports:
```typescript
import { Colors } from '@/constants/theme';
import { powersync } from '@/db/provider';
```

### TypeScript

- **Strict mode is enabled** - ensure all code is fully typed
- Use `interface` for object shapes, `type` for unions/utility types
- Explicitly type function parameters and return values for service functions
- Use `type` imports for types: `import type { Order } from '@/db/models'`

```typescript
// Component props
interface TableCardProps {
  table: TableWithOrder;
  elapsedMinutes: number;
  onPress: () => void;
}

export function TableCard({ table, elapsedMinutes, onPress }: TableCardProps) {
  // ...
}

// Service functions
export async function createOrder(
  branchId: number,
  tableId: number,
  cashierId: number
): Promise<Order> {
  // ...
}
```

### Components

- Use functional components with named exports
- Define props interfaces above the component with `Props` suffix or `ComponentNameProps`
- Use NativeWind `className` prop for styling (not `style`)

```typescript
interface MenuItemCardProps {
  item: MenuItem;
  onPress: () => void;
}

export function MenuItemCard({ item, onPress }: MenuItemCardProps) {
  return (
    <Pressable onPress={onPress} className="rounded-xl bg-surface-card p-4">
      {/* ... */}
    </Pressable>
  );
}
```

### Styling (NativeWind/Tailwind)

Use the custom theme tokens defined in `tailwind.config.js`:

**Colors:**
- `bg-surface`, `bg-surface-soft`, `bg-surface-card`, `bg-surface-raised`
- `bg-brand`, `bg-brand-hover`, `bg-brand-press`
- `text-pos-text`, `text-pos-text-strong`, `text-pos-muted`
- `text-pos-success`, `text-pos-warning`, `text-pos-danger`

**Font Sizes:**
- `text-pos-xs`, `text-pos-sm`, `text-pos-base`, `text-pos-lg`, `text-pos-xl`, `text-pos-2xl`, `text-pos-3xl`

**Spacing:**
- `min-h-pos-touch` (48px minimum touch target)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TableCard`, `OrderPanel` |
| Files (components) | PascalCase | `TableCard.tsx` |
| Files (hooks, services, utils) | kebab-case | `use-menu.ts`, `order.service.ts` |
| Hooks | camelCase with `use` prefix | `useMenu`, `useTables` |
| Constants/enums | SCREAMING_SNAKE_CASE | `ORDER_STATUS`, `TABLE_STATUS` |
| Functions | camelCase | `createOrder`, `formatIDR` |
| Interfaces | PascalCase | `OrderItem`, `TableCardProps` |

### Enums

Define enums as const objects with `as const` and export both the object and type:

```typescript
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
```

### Error Handling

- Use try/catch with typed error checking
- Log errors with descriptive prefixes using `console.error`
- Throw descriptive Error messages

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  console.error('[ServiceName] Error description:', error);
  throw new Error('User-friendly error message');
}

// Type checking errors
if (error instanceof Error) {
  console.error(error.message);
}
```

### Database Operations

Use the PowerSync instance from `@/db/provider`:

```typescript
import { powersync } from '@/db/provider';

// Query with type
const order = await powersync.getOptional<Order>(
  `SELECT * FROM orders WHERE id = ?`,
  [orderId]
);

// Execute
await powersync.execute(
  `UPDATE orders SET status = ? WHERE id = ?`,
  [ORDER_STATUS.COMPLETED, orderId]
);

// Get all rows
const items = await powersync.getAll<OrderItem>(
  `SELECT * FROM order_items WHERE order_id = ?`,
  [orderId]
);
```

### React Hooks

- Custom hooks use `use` prefix and are in `hooks/` directory
- Return objects with named properties for clarity
- Use `useQuery` from `@powersync/react` for reactive database queries

```typescript
export function useMenu() {
  const { data: menuItems, isLoading } = useQuery<MenuItem>(
    `SELECT * FROM menu_items WHERE is_active = 1 ORDER BY sort_order ASC`
  );

  return {
    menuItems,
    isLoading,
    getMenuItemsByCategory: (categoryId: number) => { /* ... */ },
  };
}
```

### Environment Variables

Use `EXPO_PUBLIC_` prefix for client-side environment variables:

```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
```

### Comments

- Use JSDoc-style comments for functions with `@param` and `@returns`
- Use `{/* */}` comments in JSX for section headers

```typescript
/**
 * Creates a new order for a table.
 * @param branchId - The branch ID
 * @param tableId - The table ID
 * @returns The created order
 */
export async function createOrder(branchId: number, tableId: number): Promise<Order> {
  // ...
}
```

```tsx
<View>
  {/* Header Section */}
  <View className="p-4">
    {/* ... */}
  </View>
</View>
```

## Important Notes

- **Landscape orientation** is enforced for the POS system
- **Currency** is Indonesian Rupiah (IDR) - use `formatIDR()` from `@/utils/currency`
- **Security**: Authentication includes PIN unlock, rate limiting, and session management
- **Offline-first**: PowerSync enables offline operation with background sync
