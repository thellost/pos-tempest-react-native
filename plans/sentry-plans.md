# Sentry Integration Plan — POS Tempest

> **Current state:** Sentry SDK installed, `Sentry.init()` in `app/_layout.tsx` with DSN, mobile replay, and feedback. Metro config wired. But NO user context, NO breadcrumbs, NO performance monitoring, NO API wrappers, NO error boundaries, and `console.error` is used everywhere instead of Sentry.

---

## Table of Contents

1. [Error Tracking (Baseline)](#1-error-tracking-baseline)
2. [Breadcrumbs](#2-breadcrumbs)
3. [User Context](#3-user-context)
4. [Custom Messages (Lightweight Logging)](#4-custom-messages-lightweight-logging)
5. [Performance Monitoring](#5-performance-monitoring)
6. [API Monitoring Wrapper](#6-api-monitoring-wrapper)
7. [Release Tracking](#7-release-tracking)
8. [Error Boundary Component](#8-error-boundary-component)
9. [Offline / PowerSync Error Capture](#9-offline--powersync-error-capture)
10. [Source Maps](#10-source-maps)
11. [Environment-Based Configuration](#11-environment-based-configuration)
12. [Centralized Sentry Logger Utility](#12-centralized-sentry-logger-utility)

---

## 1. Error Tracking (Baseline)

> **Goal:** Every unhandled exception and every `catch` block reports to Sentry with full context.

### Current State
- `Sentry.init()` exists but only catches unhandled JS exceptions
- All service files use `try/catch` with `console.error` — none report to Sentry
- `audit.service.ts` silently swallows errors
- `lib/security.ts` rate limiter errors are `console.error` only

### Steps

#### 1.1 Create `lib/sentry.ts` — Centralized Sentry helpers
```
File: lib/sentry.ts
```
- Export a `captureError(error, context?)` wrapper that:
  - Calls `Sentry.captureException(error)`
  - Attaches extra context (service name, operation, relevant IDs)
  - Tags the error with `module` (e.g. `order`, `payment`, `auth`)
  - Sets severity level based on context
- Export `captureMessage(message, level?, extras?)` for non-exception events
- Export severity constants: `fatal`, `error`, `warning`, `info`

#### 1.2 Retrofit ALL service files to report errors
Each service file needs its `catch` blocks updated:

| File | Current | Change |
|------|---------|--------|
| `services/order.service.ts` | `throw error` (caught at hook level) | Add `Sentry.captureException` in hooks that catch |
| `services/payment.service.ts` | `throw error` | Same pattern |
| `services/kitchen.service.ts` | `throw error` | Same pattern |
| `services/inventory.service.ts` | `throw error` | Same pattern |
| `services/shift.service.ts` | `throw error` | Same pattern |
| `services/device.service.ts` | `throw error` | Same pattern |
| `services/receipt.service.ts` | `throw error` | Same pattern |
| `services/calculator.service.ts` | `throw error` | Same pattern |
| `services/audit.service.ts` | `console.error` swallowed | Add `Sentry.captureException` (non-throwing) |

#### 1.3 Retrofit ALL hook files to capture errors at the catch boundary
Hooks are the final catch boundary before UI. Update:

| File | Errors to capture |
|------|-------------------|
| `hooks/use-auth.tsx` | Login failures, session errors, profile fetch errors |
| `hooks/use-device.tsx` | Device registration failures, device fetch errors |
| `hooks/use-customers.ts` | Customer creation/fetch errors |
| `hooks/use-order.ts` | Order CRUD errors |
| `hooks/use-online-check.ts` | Network check failures (as warning, not error) |
| Any other `use-*.ts` hooks | All catch blocks |

#### 1.4 Categorize errors by severity
Define clear severity rules:

| Severity | When |
|----------|------|
| `fatal` | App crash, unrecoverable state, PowerSync DB corruption |
| `error` | Feature can't be used: API unreachable, payment failure, order creation failure, inventory/reservation API failures |
| `warning` | Degraded experience: slow sync, retry succeeded, network flap |
| `info` | Expected edge cases: session expired, rate limit hit |

#### 1.5 Tag errors with business context
Every `captureException` should include:
```ts
Sentry.withScope(scope => {
  scope.setTag('service', 'order');
  scope.setTag('operation', 'createOrder');
  scope.setExtra('orderId', orderId);
  scope.setExtra('tableId', tableId);
  Sentry.captureException(error);
});
```

---

## 2. Breadcrumbs

> **Goal:** Every user interaction and system event leaves a trail so we can reconstruct what happened before a crash.

### Steps

#### 2.1 Define breadcrumb categories
```ts
type BreadcrumbCategory =
  | 'navigation'      // Screen changes
  | 'ui.click'        // Button presses, menu selections
  | 'auth'            // Login, logout, lock, unlock
  | 'order'           // Order lifecycle events
  | 'payment'         // Payment attempts, completions
  | 'kitchen'         // KOT sent, status changes
  | 'inventory'       // Stock checks, adjustments
  | 'reservation'     // Table reservations
  | 'sync'            // PowerSync events
  | 'device'          // Device registration, setup
  | 'shift'           // Shift open/close
  | 'customer'        // Customer CRUD
  | 'network'         // Online/offline transitions
  | 'print';          // Receipt printing
```

#### 2.2 Create `addBreadcrumb` helper in `lib/sentry.ts`
```ts
export function addBreadcrumb(
  category: BreadcrumbCategory,
  message: string,
  data?: Record<string, unknown>,
  level?: Sentry.SeverityLevel
) {
  Sentry.addBreadcrumb({ category, message, data, level: level ?? 'info' });
}
```

#### 2.3 Navigation breadcrumbs (automatic)
- Add `Sentry.reactNavigationIntegration()` to the Sentry init integrations
- Wire it to the Expo Router navigation container ref
- This auto-captures every screen transition

#### 2.4 Auth breadcrumbs — `hooks/use-auth.tsx`
Add breadcrumbs at each auth event:
- `auth` / "Login attempt" → on `signIn()` call
- `auth` / "Login success" → after successful auth
- `auth` / "Login failed" → on error (include safe error message)
- `auth` / "Logout" → on `signOut()`
- `auth` / "Screen locked (idle)" → on `lock()`
- `auth` / "PIN unlock attempt" → on `unlockWithPin()`
- `auth` / "PIN unlock success/failed"
- `auth` / "Session expired"
- `auth` / "Account locked (rate limit)"

#### 2.5 Order breadcrumbs — `services/order.service.ts` + `hooks/use-order.ts`
- `order` / "Order created" → `{ orderId, tableId, itemCount }`
- `order` / "Item added to order" → `{ orderId, menuItemId, qty }`
- `order` / "Item removed from order"
- `order` / "Order status changed" → `{ orderId, from, to }`
- `order` / "Order voided" → `{ orderId, reason }`
- `order` / "Discount applied" → `{ orderId, discountType, amount }`

#### 2.6 Payment breadcrumbs — `services/payment.service.ts`
- `payment` / "Payment initiated" → `{ orderId, method, amount }`
- `payment` / "Payment completed" → `{ orderId, method, transactionId }`
- `payment` / "Payment failed" → `{ orderId, method, error }`
- `payment` / "Refund processed" → `{ orderId, amount }`
- `payment` / "Split payment" → `{ orderId, splits }`

#### 2.7 Kitchen breadcrumbs — `services/kitchen.service.ts`
- `kitchen` / "KOT sent" → `{ orderId, ticketNumber, itemCount }`
- `kitchen` / "KOT status updated" → `{ ticketId, from, to }`

#### 2.8 Shift breadcrumbs — `services/shift.service.ts`
- `shift` / "Shift opened" → `{ shiftId, userId, openingBalance }`
- `shift` / "Shift closed" → `{ shiftId, closingBalance, totalSales }`

#### 2.9 Device & Sync breadcrumbs — `hooks/use-device.tsx`, `db/connector.ts`
- `device` / "Device registered" → `{ deviceId, deviceName }`
- `sync` / "PowerSync connected"
- `sync` / "PowerSync upload error" → `{ table, error }`
- `sync` / "PowerSync credential refresh"
- `network` / "Online status changed" → `{ isOnline }`

#### 2.10 Inventory & Reservation breadcrumbs — `services/inventory.service.ts`
- `inventory` / "Stock adjusted" → `{ itemId, oldQty, newQty }`
- `inventory` / "Low stock alert" → `{ itemId, currentQty }`
- `reservation` / "Reservation created" → `{ tableId, time, partySize }`

#### 2.11 Print breadcrumbs — `lib/printer.ts`
- `print` / "Receipt print started" → `{ orderId }`
- `print` / "Receipt print success/failed"

#### 2.12 UI interaction breadcrumbs (key screens)
Add breadcrumbs for important button presses in:
- Floor screen: table tapped, table long-pressed
- Menu screen: category changed, item tapped, search used
- Checkout screen: payment method selected, confirm button
- Settings screen: any setting changed

---

## 3. User Context

> **Goal:** Every Sentry event is tagged with who did it, on which device, at which branch.

### Steps

#### 3.1 Set user context on login — `hooks/use-auth.tsx`
After profile is loaded successfully:
```ts
Sentry.setUser({
  id: String(user.id),
  email: user.email ?? undefined,
  username: user.name,
  // Custom fields
  data: {
    role: user.role_name,
    branchId: user.branch_id,
    supabaseAuthId: user.supabase_auth_id,
  }
});
```

#### 3.2 Clear user context on logout — `hooks/use-auth.tsx`
```ts
Sentry.setUser(null);
```

#### 3.3 Set device tags — `hooks/use-device.tsx`
After device is registered/fetched:
```ts
Sentry.setTag('device.id', String(device.id));
Sentry.setTag('device.name', device.name);
Sentry.setTag('device.uid', device.uid);
Sentry.setTag('branch.id', String(device.branch_id));
Sentry.setTag('branch.name', branchName);
```

#### 3.4 Set shift context — wherever shift is loaded
```ts
Sentry.setTag('shift.id', String(shift.id));
Sentry.setTag('shift.status', shift.status);
```

#### 3.5 Set global context in `Sentry.init()`
```ts
Sentry.setContext('app', {
  timezone: Config.TIMEZONE,
  currency: Config.CURRENCY,
  taxRate: Config.TAX_RATE,
});
```

---

## 4. Custom Messages (Lightweight Logging)

> **Goal:** Capture important business events that aren't errors — as Sentry log messages, not just breadcrumbs.

### Steps

#### 4.1 Define when to use `captureMessage` vs breadcrumbs
| Use `captureMessage` (appears in Issues) | Use `addBreadcrumb` (trail only) |
|---|---|
| Feature blocked: inventory API unreachable | User tapped a button |
| Payment gateway timeout | Screen navigated |
| Order sync failed after 3 retries | Item added to cart |
| Device registration conflict | Login attempt |
| Shift close with discrepancy | PowerSync reconnected |

#### 4.2 Business event messages to capture
```ts
// Inventory/Reservation — API-dependent features that might fail
Sentry.captureMessage('Inventory API unreachable', 'error');
Sentry.captureMessage('Reservation API unreachable', 'error');

// Payment edge cases
Sentry.captureMessage('Payment timeout — customer waiting', 'error');
Sentry.captureMessage('Split payment rounding discrepancy', 'warning');

// Sync issues
Sentry.captureMessage('PowerSync upload failed after retries', 'error');
Sentry.captureMessage('Stale data detected — last sync >5min ago', 'warning');

// Shift anomalies
Sentry.captureMessage('Shift closing balance mismatch', 'warning');

// Device issues
Sentry.captureMessage('Device deactivated remotely', 'warning');
```

#### 4.3 Use Sentry structured logs (already enabled via `enableLogs: true`)
For lightweight debug-level logging:
```ts
Sentry.logger.info('Order created', { orderId, total });
Sentry.logger.warn('Slow query detected', { query, durationMs });
Sentry.logger.error('Sync failure', { table, error });
```

---

## 5. Performance Monitoring

> **Goal:** Track slow operations, screen load times, and business-critical transaction durations.

### Steps

#### 5.1 Enable tracing in `Sentry.init()`
```ts
Sentry.init({
  // ... existing config
  tracesSampleRate: 0.2, // 20% of transactions (adjust based on volume)
  profilesSampleRate: 0.1, // 10% of traced transactions get profiled
  enableTracing: true,
});
```

#### 5.2 Screen load performance (automatic with navigation integration)
The `Sentry.reactNavigationIntegration()` from step 2.3 will auto-capture:
- Time to initial display (TTID) for each screen
- Time to full display (TTFD) for each screen
- Screen transition durations

#### 5.3 Custom transactions for critical business flows
Wrap these operations in Sentry transactions:

| Transaction | Where | Spans |
|-------------|-------|-------|
| `order.create` | `services/order.service.ts` | validate → insert order → insert items → insert taxes → audit log |
| `order.checkout` | Checkout flow | calculate totals → apply discounts → process payment → update order status |
| `payment.process` | `services/payment.service.ts` | validate → record payment → update order → print receipt |
| `shift.open` | `services/shift.service.ts` | validate → insert shift → update device |
| `shift.close` | `services/shift.service.ts` | calculate totals → validate balance → close shift → generate report |
| `kitchen.sendKOT` | `services/kitchen.service.ts` | generate ticket → insert KOT → update items |
| `auth.login` | `hooks/use-auth.tsx` | rate limit check → supabase auth → fetch profile → set context |
| `sync.upload` | `db/connector.ts` | each CRUD batch upload to Supabase |

#### 5.4 Implementation pattern
```ts
const transaction = Sentry.startTransaction({ name: 'order.create', op: 'db' });
const span = transaction.startChild({ op: 'db.insert', description: 'Insert order row' });
// ... do work
span.finish();
transaction.finish();
```
Or using the newer API:
```ts
await Sentry.startSpan({ name: 'order.create', op: 'function' }, async (span) => {
  await Sentry.startSpan({ name: 'insert_order', op: 'db' }, async () => {
    // ... insert order
  });
  await Sentry.startSpan({ name: 'insert_items', op: 'db' }, async () => {
    // ... insert items
  });
});
```

#### 5.5 Slow operation alerts
Configure in Sentry dashboard:
- Alert if `order.create` P95 > 3s
- Alert if `payment.process` P95 > 5s
- Alert if `sync.upload` P95 > 10s

---

## 6. API Monitoring Wrapper

> **Goal:** Every outbound HTTP request is traced, timed, and errors are captured.

### Steps

#### 6.1 Create `lib/api.ts` — Instrumented fetch wrapper
```ts
export async function sentryFetch(
  url: string,
  options?: RequestInit & { operationName?: string }
): Promise<Response> {
  return Sentry.startSpan(
    { name: options?.operationName ?? url, op: 'http.client' },
    async (span) => {
      const start = Date.now();
      try {
        const response = await fetch(url, options);
        span.setData('http.status_code', response.status);
        span.setData('http.response_content_length', response.headers.get('content-length'));

        if (!response.ok) {
          Sentry.addBreadcrumb({
            category: 'http',
            message: `${options?.method ?? 'GET'} ${url} → ${response.status}`,
            level: response.status >= 500 ? 'error' : 'warning',
            data: { status: response.status, duration: Date.now() - start },
          });
        }

        return response;
      } catch (error) {
        span.setStatus('internal_error');
        Sentry.captureException(error, {
          tags: { 'http.url': url, 'http.method': options?.method ?? 'GET' },
        });
        throw error;
      }
    }
  );
}
```

#### 6.2 Wrap Supabase client calls
Supabase uses `fetch` internally. Add the Sentry fetch integration:
```ts
// In Sentry.init() integrations
Sentry.browserTracingIntegration({
  traceFetch: true,
  traceXHR: true,
})
```
This will auto-instrument all `fetch()` calls including Supabase REST calls.

#### 6.3 Update `hooks/use-online-check.ts`
Replace raw `fetch` with `sentryFetch`:
```ts
const res = await sentryFetch(url, {
  method: 'GET',
  signal: controller.signal,
  operationName: 'health-check',
});
```

#### 6.4 Wrap PowerSync connector — `db/connector.ts`
Instrument `fetchCredentials()` and `uploadData()`:
- Add spans for token refresh
- Add spans for each CRUD batch upload
- Capture upload errors with table context

---

## 7. Release Tracking

> **Goal:** Every Sentry event is associated with a specific app version so we can track regressions per release.

### Steps

#### 7.1 Set release and dist in `Sentry.init()`
```ts
import Constants from 'expo-constants';

Sentry.init({
  // ... existing config
  release: `com.thellost.postempest@${Constants.expoConfig?.version}`,
  dist: Constants.expoConfig?.extra?.eas?.buildNumber ?? '1',
  environment: __DEV__ ? 'development' : 'production',
});
```

#### 7.2 Configure EAS Build to upload source maps
In `eas.json` (create if not exists):
```json
{
  "build": {
    "production": {
      "env": {
        "SENTRY_AUTH_TOKEN": "@sentry-auth-token"
      }
    }
  }
}
```

#### 7.3 Add Sentry auth token to EAS secrets
```bash
eas secret:create --name SENTRY_AUTH_TOKEN --value <your-token>
```

#### 7.4 Verify Expo plugin config in `app.json`
Already configured:
```json
["@sentry/react-native/expo", {
  "url": "https://sentry.io/",
  "project": "react-native",
  "organization": "zidanid"
}]
```
This auto-uploads source maps during EAS Build.

#### 7.5 Add version bump script
Consider adding to `package.json`:
```json
"scripts": {
  "version:patch": "npx expo-version patch",
  "version:minor": "npx expo-version minor"
}
```

---

## 8. Error Boundary Component

> **Goal:** Catch React render crashes gracefully with a fallback UI instead of a white screen.

### Steps

#### 8.1 Create `components/ErrorBoundary.tsx`
Use `Sentry.ErrorBoundary` wrapper:
```tsx
import * as Sentry from '@sentry/react-native';

function ErrorFallback({ error, resetError }) {
  return (
    <View>
      <Text>Something went wrong</Text>
      <Text>{error.message}</Text>
      <Button title="Try Again" onPress={resetError} />
    </View>
  );
}

export function AppErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary
      fallback={ErrorFallback}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'app');
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

#### 8.2 Wrap critical route groups
- Wrap `(app)/_layout.tsx` children with `<AppErrorBoundary>`
- Wrap `(auth)/_layout.tsx` children with `<AppErrorBoundary>`
- Optionally wrap individual high-risk screens (checkout, payments)

#### 8.3 Create screen-level error boundary for critical flows
For checkout and payment screens, create a specialized boundary:
```tsx
<Sentry.ErrorBoundary
  fallback={PaymentErrorFallback}
  beforeCapture={(scope) => {
    scope.setTag('boundary', 'payment');
    scope.setLevel('fatal');
  }}
>
  <CheckoutScreen />
</Sentry.ErrorBoundary>
```

---

## 9. Offline / PowerSync Error Capture

> **Goal:** Track sync failures, upload errors, and offline-specific issues that might silently break data.

### Steps

#### 9.1 Instrument `db/connector.ts` — `uploadData()`
Currently errors are caught with a hint system. Add Sentry:
```ts
catch (error) {
  Sentry.captureException(error, {
    tags: { module: 'powersync', operation: 'upload', table: op.table },
    extra: { opType: op.op, recordId: op.id },
  });
  // ... existing hint logic
  throw error;
}
```

#### 9.2 Instrument `db/connector.ts` — `fetchCredentials()`
Capture token refresh failures:
```ts
catch (error) {
  Sentry.captureException(error, {
    tags: { module: 'powersync', operation: 'fetchCredentials' },
  });
  throw error;
}
```

#### 9.3 Monitor PowerSync status in `db/provider.tsx`
Add a listener for PowerSync status changes:
```ts
powersync.registerListener({
  statusChanged: (status) => {
    Sentry.addBreadcrumb({
      category: 'sync',
      message: `PowerSync status: ${status.connected ? 'connected' : 'disconnected'}`,
      data: { connected: status.connected, lastSyncedAt: status.lastSyncedAt },
    });
  },
});
```

#### 9.4 Detect and alert on stale data
If `lastSyncedAt` is more than 5 minutes ago and device is online:
```ts
Sentry.captureMessage('PowerSync stale — no sync for 5+ minutes while online', {
  level: 'warning',
  tags: { module: 'powersync' },
  extra: { lastSyncedAt, minutesStale },
});
```

---

## 10. Source Maps

> **Goal:** Stack traces in Sentry show original TypeScript source, not minified bundles.

### Steps

#### 10.1 Verify metro config (already done)
```js
// metro.config.js — already uses getSentryExpoConfig
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const config = getSentryExpoConfig(__dirname);
```
This auto-generates source maps during bundling.

#### 10.2 Verify Expo plugin (already done)
The `@sentry/react-native/expo` plugin in `app.json` handles source map upload during EAS Build.

#### 10.3 For local dev builds
Source maps are automatically available in dev mode. For production testing:
```bash
npx expo export --platform android --source-maps
npx sentry-cli sourcemaps upload --release <release> ./dist
```

#### 10.4 Test source map resolution
After first production build:
1. Trigger a test error
2. Check Sentry dashboard for readable stack trace
3. Verify file paths resolve to `.ts`/`.tsx` sources

---

## 11. Environment-Based Configuration

> **Goal:** Different Sentry behavior for development vs production.

### Steps

#### 11.1 Update `Sentry.init()` in `app/_layout.tsx`
```ts
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__, // Disable in dev (or set to true if you want dev events)
  debug: __DEV__, // Show Sentry debug logs in dev

  // Sampling
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  profilesSampleRate: __DEV__ ? 0 : 0.1,

  // Release
  release: `com.thellost.postempest@${Constants.expoConfig?.version}`,
  dist: String(Constants.expoConfig?.extra?.eas?.buildNumber ?? 1),

  sendDefaultPii: true,
  enableLogs: true,

  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
    Sentry.reactNavigationIntegration(),
  ],

  beforeSend(event) {
    // Scrub any sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }
    return event;
  },
});
```

#### 11.2 Move DSN to environment variable
In `.env`:
```
EXPO_PUBLIC_SENTRY_DSN=https://1c005b8ac82e51e8b9f3d1f6c52528c9@o4511089167695872.ingest.us.sentry.io/4511089168744448
```

#### 11.3 Add `beforeSend` filter
Filter out known noise:
```ts
beforeSend(event, hint) {
  const error = hint.originalException;
  // Skip network errors in offline-first app (expected behavior)
  if (error?.message?.includes('Network request failed') && !isOnline) {
    return null;
  }
  return event;
},
```

---

## 12. Centralized Sentry Logger Utility

> **Goal:** Replace scattered `console.error`/`console.log` calls with a utility that logs to both console (dev) AND Sentry (prod).

### Steps

#### 12.1 Create `lib/sentry.ts`
This is the single import point for all Sentry operations:

```ts
import * as Sentry from '@sentry/react-native';

// ── Error Capture ───────────────────────────────────────────────
export function captureError(
  error: unknown,
  context: {
    module: string;
    operation: string;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
  }
) {
  if (__DEV__) console.error(`[${context.module}] ${context.operation}:`, error);

  Sentry.withScope((scope) => {
    scope.setTag('module', context.module);
    scope.setTag('operation', context.operation);
    if (context.level) scope.setLevel(context.level);
    if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    if (context.extras) scope.setExtras(context.extras);
    Sentry.captureException(error);
  });
}

// ── Breadcrumbs ─────────────────────────────────────────────────
export type BreadcrumbCategory =
  | 'navigation' | 'ui.click' | 'auth' | 'order' | 'payment'
  | 'kitchen' | 'inventory' | 'reservation' | 'sync' | 'device'
  | 'shift' | 'customer' | 'network' | 'print';

export function addBreadcrumb(
  category: BreadcrumbCategory,
  message: string,
  data?: Record<string, unknown>,
  level?: Sentry.SeverityLevel
) {
  if (__DEV__) console.log(`[${category}] ${message}`, data ?? '');
  Sentry.addBreadcrumb({ category, message, data, level: level ?? 'info' });
}

// ── User Context ────────────────────────────────────────────────
export function setUserContext(user: { id: number; name: string; email?: string | null; role: string; branchId: number }) { ... }
export function clearUserContext() { Sentry.setUser(null); }

// ── Device Context ──────────────────────────────────────────────
export function setDeviceContext(device: { id: number; name: string; uid: string; branchId: number }) { ... }
```

#### 12.2 Migration plan — Replace `console.error` calls
Search and replace across the codebase:

| Pattern | Replace with |
|---------|-------------|
| `console.error('[AuditService]', ...)` | `captureError(error, { module: 'audit', operation: '...' })` |
| `console.error('[DbRateLimiter]', ...)` | `captureError(error, { module: 'auth', operation: 'rateLimitCheck' })` |
| `console.error('[DeviceService]', ...)` | `captureError(error, { module: 'device', operation: '...' })` |
| `console.log('[AuthProvider]', ...)` (errors) | `captureError(...)` |
| `console.warn('[PowerSync]', ...)` | `addBreadcrumb('sync', ...)` |

#### 12.3 Keep `console.log` for dev-only debug output
Do NOT remove all console.logs. Keep them for local dev debugging via the `__DEV__` guard in the utility functions. The utility will:
- **Dev mode:** `console.log` + Sentry breadcrumb
- **Prod mode:** Sentry breadcrumb only (no console noise)

---

## Implementation Order (Recommended)

| Phase | Tasks | Priority | Effort |
|-------|-------|----------|--------|
| **Phase 1** | 12 → 11 → 1 | MUST HAVE | ~4h |
| | Create `lib/sentry.ts`, env config, retrofit error capture | | |
| **Phase 2** | 3 → 2 | MUST HAVE | ~3h |
| | User/device context, all breadcrumbs | | |
| **Phase 3** | 8 → 9 | HIGH | ~2h |
| | Error boundaries, PowerSync error capture | | |
| **Phase 4** | 4 → 5 | MEDIUM | ~3h |
| | Custom messages, performance transactions | | |
| **Phase 5** | 6 → 7 → 10 | MEDIUM | ~2h |
| | API wrapper, release tracking, source maps | | |

**Total estimated effort: ~14h across 5 phases**

---

## Files to Create

| File | Purpose |
|------|---------|
| `lib/sentry.ts` | Centralized Sentry utility (captureError, addBreadcrumb, setUserContext, etc.) |
| `lib/api.ts` | Instrumented fetch wrapper with Sentry spans |
| `components/ErrorBoundary.tsx` | Sentry-powered error boundary with fallback UI |

## Files to Modify

| File | Changes |
|------|---------|
| `app/_layout.tsx` | Enhanced Sentry.init config (env-based, tracing, navigation integration) |
| `hooks/use-auth.tsx` | Set/clear user context, auth breadcrumbs, capture login errors |
| `hooks/use-device.tsx` | Set device tags, device breadcrumbs, capture registration errors |
| `hooks/use-order.ts` | Order breadcrumbs, capture order errors |
| `hooks/use-customers.ts` | Customer breadcrumbs, capture errors |
| `hooks/use-online-check.ts` | Network breadcrumbs, use instrumented fetch |
| `services/order.service.ts` | Order breadcrumbs, performance spans |
| `services/payment.service.ts` | Payment breadcrumbs, performance spans |
| `services/kitchen.service.ts` | Kitchen breadcrumbs, performance spans |
| `services/shift.service.ts` | Shift breadcrumbs |
| `services/inventory.service.ts` | Inventory breadcrumbs, error capture |
| `services/device.service.ts` | Device breadcrumbs |
| `services/receipt.service.ts` | Print breadcrumbs |
| `services/audit.service.ts` | Replace console.error with captureError |
| `services/calculator.service.ts` | Error capture |
| `lib/security.ts` | Replace console.error in rate limiter |
| `db/connector.ts` | Sync error capture, upload spans |
| `db/provider.tsx` | PowerSync status breadcrumbs |
| `app.json` | No changes needed (plugin already configured) |
| `metro.config.js` | No changes needed (already using getSentryExpoConfig) |
| `.env` | Add `EXPO_PUBLIC_SENTRY_DSN` |

---

## Sentry Dashboard Configuration (Post-Implementation)

1. **Alerts:**
   - Error spike > 10 events/min → Slack/email
   - New error type in `payment` module → immediate alert
   - P95 latency for `order.create` > 3s → warning
   - PowerSync stale data → warning

2. **Issue Grouping:**
   - Group by `module` tag
   - Separate grouping for `payment` errors (business-critical)

3. **Dashboards:**
   - "POS Health" — error rate, sync status, active devices
   - "Business Ops" — order creation rate, payment success rate
   - "Performance" — screen load times, slow transactions
