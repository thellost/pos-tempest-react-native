import * as Sentry from '@sentry/react-native';

// ── Error Capture ─────────────────────────────────────────────────────────────

export function captureError(
  error: unknown,
  context: {
    module: string;
    operation: string;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
  },
): void {
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

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

export type BreadcrumbCategory =
  | 'navigation'
  | 'ui.click'
  | 'auth'
  | 'order'
  | 'payment'
  | 'kitchen'
  | 'inventory'
  | 'reservation'
  | 'sync'
  | 'device'
  | 'shift'
  | 'customer'
  | 'network'
  | 'print';

export function addBreadcrumb(
  category: BreadcrumbCategory,
  message: string,
  data?: Record<string, unknown>,
  level?: Sentry.SeverityLevel,
): void {
  if (__DEV__) console.log(`[${category}] ${message}`, data ?? '');
  Sentry.addBreadcrumb({ category, message, data, level: level ?? 'info' });
}

// ── User Context ──────────────────────────────────────────────────────────────

export function setUserContext(user: {
  id: number;
  name: string;
  email?: string | null;
  role_name: string;
  branch_id: number;
  supabase_auth_id: string;
}): void {
  Sentry.setUser({
    id: String(user.id),
    email: user.email ?? undefined,
    username: user.name,
    // Custom fields
    role: user.role_name,
    branchId: user.branch_id,
    supabaseAuthId: user.supabase_auth_id,
  });
}

export function clearUserContext(): void {
  Sentry.setUser(null);
}

// ── Device Context ────────────────────────────────────────────────────────────

export function setDeviceContext(device: {
  id: number;
  name: string;
  uid: string;
  branch_id: number;
}): void {
  Sentry.setTag('device.id', String(device.id));
  Sentry.setTag('device.name', device.name);
  Sentry.setTag('device.uid', device.uid);
  Sentry.setTag('branch.id', String(device.branch_id));
}
