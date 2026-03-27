/**
 * Audit Service for POS Tempest
 *
 * Provides a single `insertAuditLog()` helper used by all services to write
 * tamper-evident audit trail entries to the `audit_logs` table.
 *
 * ## Device context strategy (no schema changes)
 * Since no schema changes are allowed, device identity is stored in two
 * existing text columns that have no meaning in a native app context:
 *
 *   - `session_id`  → device DB integer ID (as string) — enables JOIN on devices.id
 *   - `user_agent`  → human-readable label, e.g. "Kasir 1 (abc-uuid)"
 *
 * ## Module-level context
 * Device and user context are registered once at app startup via the setters
 * below and are automatically injected into every subsequent audit log entry,
 * so individual service functions don't need to pass them explicitly.
 *
 *   - `setAuditDeviceContext()` — called by `hooks/use-device.tsx`
 *   - `setAuditUserContext()`   — called by `hooks/use-auth.tsx`
 */

import * as Crypto from 'expo-crypto';

import type { AuditAction } from '@/constants/enums';
import { powersync } from '@/db/provider';
import { captureError } from '@/lib/sentry';

// ── Module-level context ──────────────────────────────────────────────────────

/** UUID of the registered device (stored in audit_logs.session_id). */
let _deviceId: string | null = null;

/** Human-readable device label, e.g. "Kasir 1 (device-uuid)" (stored in audit_logs.user_agent). */
let _deviceInfo: string | null = null;

/** Integer DB primary key of the currently authenticated cashier. */
let _userId: number | null = null;

/** Branch ID that the current device/user belongs to. */
let _branchId: number | null = null;

/**
 * Register the device context for all subsequent audit log entries.
 * Call from `hooks/use-device.tsx` once device registration is confirmed.
 *
 * @param deviceId   - DB integer PK of the device
 * @param deviceInfo - Human-readable label, e.g. "Kasir 1 (uuid)"
 */
export function setAuditDeviceContext(deviceId: string | null, deviceInfo: string | null): void {
  _deviceId = deviceId;
  _deviceInfo = deviceInfo;
}

/**
 * Register the user context for all subsequent audit log entries.
 * Call from `hooks/use-auth.tsx` when a user profile is loaded or on logout.
 *
 * @param userId   - DB integer PK of the authenticated user (null on logout)
 * @param branchId - Branch the user belongs to (null on logout)
 */
export function setAuditUserContext(userId: number | null, branchId: number | null): void {
  _userId = userId;
  _branchId = branchId;
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface AuditLogParams {
  /** The type of action performed. Must be a value from the `AUDIT_ACTION` const. */
  action: AuditAction;

  /** The database table the action affects (e.g. 'orders', 'payments'). */
  tableName: string;

  /** Primary key of the affected record (stored as text — accepts integers or UUIDs). */
  recordId?: string | number | null;

  /**
   * Override the module-level user ID.
   * Provide this when the service function already knows the acting user
   * (e.g. `voidedBy`, `appliedBy`). Falls back to the context registered via
   * `setAuditUserContext()` when omitted or explicitly `undefined`.
   */
  userId?: number | null;

  /**
   * Override the module-level branch ID.
   * Falls back to the context registered via `setAuditUserContext()` when omitted.
   */
  branchId?: number | null;

  /** State before the action (JSON-serialisable). */
  oldValues?: Record<string, unknown> | null;

  /** State after the action (JSON-serialisable). */
  newValues?: Record<string, unknown> | null;

  /** Human-readable description shown to auditors. */
  description?: string | null;
}

// ── insertAuditLog ────────────────────────────────────────────────────────────

/**
 * Insert a single audit log entry into the local `audit_logs` table.
 * PowerSync will sync it to Supabase in the background.
 *
 * Device context is **automatically injected** from the module registry:
 *   - `session_id`  ← integer device ID (queryable: `CAST(session_id AS INTEGER)`)
 *   - `user_agent`  ← device name + UID for human readability
 *
 * **Never throws.** Audit failures must never break business operations.
 */
export async function insertAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Explicit overrides take precedence over module-level context.
    const userId = params.userId !== undefined ? params.userId : _userId;
    const branchId = params.branchId !== undefined ? params.branchId : _branchId;

    const newId = Crypto.randomUUID();

    await powersync.execute(
      `INSERT INTO audit_logs (
        id, user_id, branch_id, action, table_name, record_id,
        old_values, new_values, description,
        session_id, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        userId ?? null,
        branchId ?? null,
        params.action,
        params.tableName,
        params.recordId ?? null,
        params.oldValues ? JSON.stringify(params.oldValues) : null,
        params.newValues ? JSON.stringify(params.newValues) : null,
        params.description ?? null,
        // session_id stores the device integer ID for JOIN-able queryability
        _deviceId !== null ? String(_deviceId) : null,
        // user_agent stores the human-readable device label
        _deviceInfo,
        now,
      ],
    );
  } catch (error) {
    // Capture but never re-throw — audit failures must not disrupt business operations.
    captureError(error, { module: 'audit', operation: 'insertAuditLog', level: 'warning' });
  }
}
