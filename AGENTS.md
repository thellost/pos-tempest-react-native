# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Summary

React Native POS app. **Expo v54** (Expo Router), **NativeWind** (Tailwind), **PowerSync** (local-first SQLite↔Supabase sync), **Supabase** (auth/backend), **TypeScript** strict. Landscape-first, tablet POS, offline-capable.

**Expo Go will NOT work.** This project uses native modules (op-sqlite, Bluetooth, immersive mode). Always use development builds: `npx expo run:android` / `npx expo run:ios`.

## Commands

```bash
npm start              # Expo dev server
npm run android        # development build on Android (expo run:android)
npm run ios            # development build on iOS (expo run:ios)
npm run web            # web preview (expo start --web)
npm run lint           # ESLint (eslint-config-expo)
npx tsc --noEmit       # type-check
```

No test framework is configured.

## Development Roadmap

Before significant changes, read `.github/prompts/plan-posTempestRoadmap.prompt.md`. The 14-step plan covers floor/table management, menu/order flow, KOT/kitchen display, Bluetooth ESC/POS printing, payments, inventory, and reports.

## Provider Nesting Order (Critical)

The root `_layout.tsx` nests providers in this exact chain — order matters:

```
AppThemeProvider → ConfigProvider → PowerSyncProvider → AuthProvider → DeviceProvider
```

Breaking this chain breaks the app. `AuthProvider` depends on PowerSync being ready; `DeviceProvider` depends on auth session.

## Error Handling & Sentry

**Root wiring** — `_layout.tsx` (`app/_layout.tsx:154`) wraps the entire app in `Sentry.wrap(RootLayout)`. Sentry init sets DSN, environment, release tracking, traces sampling (100% dev, 20% prod), and navigation instrumentation. Authorization headers are scrubbed from outgoing events.

**`AppErrorBoundary`** — wraps both `(app)` and `(auth)` route groups. Uses `Sentry.ErrorBoundary` with a "Try Again" fallback UI. All uncaught render errors are tagged `boundary=app` before capture.

**`@/lib/sentry.ts`** exports the following helper functions. Use these instead of calling `Sentry.*` directly:

```typescript
// Capture exceptions with tagged module + operation context
captureError(error, { module: 'powersync', operation: 'uploadData', level: 'error' });

// Add breadcrumbs for debugging event sequences (logs to console in dev)
addBreadcrumb('sync', 'PowerSync connected', { connected: true });
// Valid categories: navigation, ui.click, auth, order, payment, kitchen,
//   inventory, reservation, sync, device, shift, customer, network, print, ota

// Capture non-exception messages
captureMessage('User logged in', 'info', { userId: 42 });

// Performance instrumentation (re-exported from @sentry/react-native)
startSpan({ name: 'createOrder', op: 'service' }, async () => { … });

// Set user context on login (called from use-auth.tsx)
setUserContext({ id, name, email, role_name, branch_id, supabase_auth_id });

// Clear user context on logout
clearUserContext();

// Set device context on registration (called from use-device.tsx)
setDeviceContext({ id, name, uid, branch_id });
```

**Service-level error handling** — services use try/catch with `console.error('[ServiceName] description:', error)` for dev visibility, plus `captureError()` for Sentry. Descriptive Error messages are thrown upward for the UI. See `services/order.service.ts` for the canonical pattern.

**Sync warnings** — `lib/sync-warnings.ts` handles unrecoverable upload errors. When PowerSync connector drops a row that can't sync (type mismatches, FK violations), a one-shot `Alert` asks the user to reset local data via Settings → Danger Zone. Sentry also captures an error event.

## Key Architecture Decisions

- **Shifts scoped to devices, not users** — cash drawer persists across user switches on same terminal
- **Branch locked per device** — each tablet registers to one branch on first launch
- **Email + PIN auth** — Supabase handles email login; PIN validated locally for offline quick-unlock
- **Offline-first** — PowerSync syncs SQLite ↔ Supabase Postgres. `EXPO_PUBLIC_POWERSYNC_URL` is optional; app works fully offline without it
- **Landscape lock is conditional** — only on tablets (min side ≥ 600px). Phones get unlocked orientation
- **React Compiler enabled** (`experiments.reactCompiler: true` in app.json) — modifies memoization behavior
- **Typed routes enabled** (`experiments.typedRoutes: true`) — Expo Router generates `.expo/types/` for type-safe navigation
- **Android immersive mode** on tablets — hides status/nav bars for kiosk-style POS

## Project Structure

```
app/                   # Expo Router file-based routes
  (app)/               # floor, order, checkout, kitchen, cash, inventory, shifts, settings…
  (auth)/              # login, pin, forgot-password
  (tabs)/              # tab navigation
components/            # Reusable UI — ~20 subdirs: floor/, menu/, order/, ui/, checkout/, kitchen/, …
hooks/                 # Custom hooks (use-menu, use-auth, use-order, use-shift, use-device…)
services/              # Business logic (order.service, shift.service, payment.service, …)
lib/                   # Third-party config: supabase.ts, powersync.ts, sentry.ts, schema.ts, printer.ts
db/                    # PowerSync layer — schema.ts, models/index.ts, provider.tsx, connector.ts
constants/             # enums.ts, config.ts, theme.ts
utils/                 # currency.ts, date.ts, order-number.ts, coerce.ts
```

Import with `@/` alias: `import { powersync } from '@/db/provider'`.

## PowerSync — How It Works

**Architecture:** PowerSync maintains a local SQLite database (via `@op-engineering/op-sqlite`) and synchronizes it bidirectionally with Supabase Postgres.

1. **Schema** — declared in `db/schema.ts` using PowerSync's `Schema`/`Table`/`column` API. This defines the local tables AND tells the PowerSync service what to replicate from Postgres.

2. **Connector** (`db/connector.ts`) — handles two responsibilities:
   - `fetchCredentials` — returns the Supabase JWT (refreshing if expiring within 60s) and the PowerSync endpoint URL
   - `uploadData` — batches pending local changes (up to 100 per batch) and applies them to Supabase via PUT/PATCH/DELETE. Unrecoverable errors (type mismatches, FK violations) cause the local row to be dropped so the queue doesn't stall. A Sentry error + one-shot user warning is surfaced.

3. **Initialization** — `PowerSyncProvider` calls `powersync.init()` then `powersync.connect(connector)`. This is a singleton promise; the provider shows a loading spinner until ready. The `PowerSyncContext.Provider` makes the database instance available to `useQuery` hooks.

4. **Reactive queries** — `useQuery` from `@powersync/react` subscribes to local DB changes. UI re-renders automatically when local data changes (whether from local writes or incoming sync).

5. **Sync direction** — downsync (Postgres → SQLite) is handled by the PowerSync cloud service via WebSocket. Upsync (SQLite → Postgres) happens through the connector's `uploadData`, which reads the CRUD batch from the local DB and pushes changes via Supabase REST.

6. **Reset** — `resetLocalData()` in `db/provider.tsx` calls `disconnectAndClear()` to wipe all local data and re-sync from the backend. Used for recovery after incompatible schema migrations.

### PowerSync Type Mapping (SQLite → TypeScript)

PowerSync columns map to JavaScript types at runtime, regardless of what the TypeScript model interfaces declare:

| PowerSync `column` | SQLite storage | JavaScript runtime | Model interface |
|---|---|---|---|
| `column.integer` | INTEGER | `number` | `number` (IDs, counts) |
| `column.integer` (bool) | INTEGER (0/1) | `number` (0 or 1) | `boolean` |
| `column.real` | REAL | `number` | `number` |
| `column.text` | TEXT | `string` | `string` |

**Critical gotcha:** Boolean columns (e.g. `is_active`, `is_available`, `is_voided`, `auto_shift`, `cash_in_flag_feature`) are stored as `column.integer` (0 or 1). At runtime these are **numbers** (0 | 1), NOT `true | false`. The model interfaces type them as `boolean` for developer convenience, but strict equality (`=== true`) will fail. Always use `Boolean(value)`, `!!value`, or truthiness checks.

```typescript
// Correct
items.filter(item => Boolean(item.is_active));
if (item.is_voided) { … }

// Wrong — these are numbers, not booleans
if (item.is_active === true) { … }
```

**Dates/timestamps** are stored as `column.text` and returned as ISO 8601 strings, never `Date` objects.

**Primary key types** — some tables use integer autoincrement IDs (`number`), others use UUID text IDs (`string`):
- Integer PK: `roles`, `users`, `branches`, `floor_areas`, `tables`, `customers`, `reservations`, `categories`, `menu_items`, `modifier_groups`, `modifiers`, `menu_item_modifier_groups`, `inventories`, `discounts`, `suppliers`, `purchases`, `purchase_items`, `menu_item_ingredients`, `cash_transaction_reasons`
- UUID PK: `shifts`, `inventory_movements`, `orders`, `order_items`, `order_item_modifiers`, `kitchen_order_tickets`, `kot_items`, `payments`, `order_discounts`, `audit_logs`, `shift_cash_transactions`, `devices`

Use `toInt()` and `toFloat()` from `@/utils/coerce` when reading DB values that may come as strings from SQLite.

## Styling & Theming

- Use NativeWind `className`, not React Native `style` prop
- Custom theme tokens in `tailwind.config.js`: `bg-surface`, `bg-surface-card`, `bg-brand`, `text-pos-text`, `text-pos-muted`, `text-pos-success/danger/warning`, `min-h-pos-touch` (48px)
- **Theme is NOT just dark** — full light/dark toggle via NativeWind `vars()`. CSS custom properties are set by `useAppTheme()` from `@/hooks/use-app-theme` and persisted to AsyncStorage. All color classes resolve to CSS vars (`var(--color-surface)`, etc.). Never hardcode colors unless using the `brand`/`accent`/`pos`/`status`/`category` static Tailwind tokens
- Fonts: **Geist** (loaded via `expo-font` in `_layout.tsx`), not system default
- Spacing scale uses `pos-` prefix tokens: `p-pos-md`, `gap-pos-lg`, etc.
- Shared themed wrapper components exist at `components/themed-text.tsx` and `components/themed-view.tsx`

## Code Conventions

- **Named exports** for components (`export function TableCard`), not default exports
- **Enums as const objects** with `as const` and exported type alias (see `constants/enums.ts`)
- **Config constants** at `constants/config.ts` — PIN length (6), lockout times, bcrypt rounds (6 — lowered for mobile), API timeouts, order prefix. Always reference these, never hardcode
- **Database import path** — use `@/db/provider` for `powersync`, `@/db/models` for types, `@/lib/powersync` for the convenience re-export
- **Currency** is IDR — use `formatIDR()` from `@/utils/currency`
- **Order numbers** — use `generateOrderNumber()` from `@/utils/order-number`, format: `ORD-YYMMDD-{deviceId6}-{seq3}-{rand2}` (e.g. `ORD-260223-A1B2C3-001-7F`). Kitchen tickets use `generateTicketNumber()` (prefix `KOT`)
- **BCrypt rounds = 6** — intentionally lowered for mobile JS performance. Do not increase

## Important Gotchas

- **Active shift required** to create orders — use `getActiveShift()` from `services/shift.service.ts` or auto-open via `openShift()`
- **Order totals are rounded** — default precision 1000 IDR (configurable per branch via `branch.rounding_precision`). See `Config.DEFAULT_ROUNDING_PRECISION`
- **Stock is auto-deducted** on order confirmation and restocked on cancellation — see `order.service.ts`
- **Permissions** — use `hasPermission()` from `@/constants/permissions` and `<PermissionGate>` component for guarded UI
- **Db schema routing** — Supabase schema name resolves at runtime via `lib/schema.ts`: `pos_tempest` in dev, `pos_tempest_prod` in production. Set via `EXPO_PUBLIC_SUPABASE_DB_SCHEMA` env override
- **Bluetooth printing** — `react-native-bluetooth-classic` + `react-native-esc-pos-printer`, Android only. Printer logic in `lib/printer.ts`, `lib/bluetooth.ts`, `lib/escpos/`
- **The `AppThemeProvider` shows a loading modal** during theme transitions (800ms spinner). Don't duplicate this pattern elsewhere
