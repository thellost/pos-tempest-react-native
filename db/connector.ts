import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/react-native';

import { POS_SCHEMA } from '@/lib/schema';
import { addBreadcrumb, captureError, startSpan } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { notifyUnrecoverableUpload } from '@/lib/sync-warnings';

function getPowerSyncEndpoint() {
	const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
	return endpoint && endpoint.trim().length > 0 ? endpoint : null;
}

function getSupabaseWriteSchema() {
	// Resolved from runtime EAS channel + env override + dev/release safety net.
	// See lib/schema.ts. Release builds NEVER fall back to the dev schema.
	return POS_SCHEMA;
}

function resolveTableTarget(rawTable: string): { schema: string; table: string } {
	const normalized = rawTable.replaceAll('"', '').trim();

	if (normalized.includes('.')) {
		const [schema, table] = normalized.split('.', 2);
		return { schema, table };
	}

	return {
		schema: getSupabaseWriteSchema(),
		table: normalized,
	};
}


type CrudOp = {
	id: string;
	table: string;
	op: 'PUT' | 'PATCH' | 'DELETE' | string;
	opData?: Record<string, unknown>;
};

async function applyCrudOperation(op: CrudOp) {
	const table = op.table;
	const rowId = op.id;

	if (!table) {
		throw new Error('Missing table name in CRUD operation');
	}

	const target = resolveTableTarget(table);
	const schemaClient = supabase.schema(target.schema);
	const tableRef = `${target.schema}.${target.table}`;

	// devices: PK is device_uid (uuid) after migration — skip stale pre-migration integer ids.
	if (target.table === 'devices') {
		const isLegacyIntegerId = /^\d+$/.test(rowId);
		if (isLegacyIntegerId) {
			console.warn(`[PowerSync upload] Skipping stale pre-migration device op (${op.op}#${rowId})`);
			return;
		}

		if (op.op === 'PUT') {
			const payload = { device_uid: rowId, ...(op.opData ?? {}) } as Record<string, unknown>;
			const { data: existingDevice, error: readError } = await schemaClient
				.from(target.table)
				.select('registered_at')
				.eq('device_uid', rowId)
				.maybeSingle<{ registered_at: string | null }>();

			if (readError) {
				throw new Error(`[PowerSync upload] Failed to read existing device metadata for ${tableRef}#${rowId}: ${readError.message}`);
			}

			if (existingDevice?.registered_at) {
				payload.registered_at = existingDevice.registered_at;
			} else if (payload.registered_at == null) {
				delete payload.registered_at;
			}

			const { error } = await schemaClient.from(target.table).upsert(payload as never, { onConflict: 'device_uid' });
			if (error) throw new Error(`[PowerSync upload] PUT failed for ${tableRef}#${rowId}: ${error.message}`);
			return;
		}
		if (op.op === 'PATCH') {
			const patch = op.opData ?? {};
			if (Object.keys(patch).length === 0) return;
			const { error } = await schemaClient.from(target.table).update(patch as never).eq('device_uid', rowId);
			if (error) throw new Error(`[PowerSync upload] PATCH failed for ${tableRef}#${rowId}: ${error.message}`);
			return;
		}
		if (op.op === 'DELETE') {
			const { error } = await schemaClient.from(target.table).delete().eq('device_uid', rowId);
			if (error) throw new Error(`[PowerSync upload] DELETE failed for ${tableRef}#${rowId}: ${error.message}`);
			return;
		}
	}

	// audit_logs is append-only — use insert (no upsert/ON CONFLICT needed).
	// old_values/new_values are JSON strings in SQLite but jsonb in Supabase, so parse them.
	if (target.table === 'audit_logs' && op.op === 'PUT') {
		const raw = { id: rowId, ...(op.opData ?? {}) } as Record<string, unknown>;
		for (const field of ['old_values', 'new_values'] as const) {
			const val = raw[field];
			if (typeof val === 'string') {
				try { raw[field] = JSON.parse(val); } catch { raw[field] = null; }
			}
		}
		// ignoreDuplicates: PowerSync may retry a batch after a network failure,
		// so the record might already exist in Supabase — silently skip it.
		const { error } = await schemaClient.from(target.table).upsert(raw as never, { onConflict: 'id', ignoreDuplicates: true });
		if (error) {
			throw new Error(`[PowerSync upload] PUT failed for ${tableRef}#${rowId}: ${error.message}`);
		}
		return;
	}

	// shifts: legacy pre-device_id shifts have device_id = null and will violate the NOT NULL
	// constraint on the Supabase shifts table. Skip PUTs with a null device_id and strip null
	// device_id from PATCHes so these stale records don't block the sync queue.
	if (target.table === 'shifts') {
		if (op.op === 'PUT') {
			const payload = op.opData ?? {};
			if (payload.device_id == null) {
				console.warn(`[PowerSync upload] Skipping legacy pre-device_id shift PUT (${tableRef}#${rowId})`);
				return;
			}
		}
		if (op.op === 'PATCH') {
			const patch = { ...(op.opData ?? {}) };
			if ('device_id' in patch && patch.device_id == null) {
				delete patch.device_id;
			}
			if (Object.keys(patch).length === 0) return;
			const { error } = await schemaClient.from(target.table).update(patch as never).eq('id', rowId);
			if (error) throw new Error(`[PowerSync upload] PATCH failed for ${tableRef}#${rowId}: ${error.message}`);
			return;
		}
	}

	if (op.op === 'PUT') {
		const payload = { id: rowId, ...(op.opData ?? {}) };
		const { error } = await schemaClient.from(target.table).upsert(payload as never, { onConflict: 'id' });
		if (error) {
			const hint = error.message.toLowerCase().includes('invalid schema')
				? ' (hint: add this schema to Supabase API Exposed schemas, or set EXPO_PUBLIC_SUPABASE_DB_SCHEMA correctly)'
				: '';
			throw new Error(`[PowerSync upload] PUT failed for ${tableRef}#${rowId}: ${error.message}${hint}`);
		}
		return;
	}

	if (op.op === 'PATCH') {
		const patch = op.opData ?? {};

		if (Object.keys(patch).length === 0) {
			return;
		}

		const { error } = await schemaClient.from(target.table).update(patch as never).eq('id', rowId);
		if (error) {
			const hint = error.message.toLowerCase().includes('invalid schema')
				? ' (hint: add this schema to Supabase API Exposed schemas, or set EXPO_PUBLIC_SUPABASE_DB_SCHEMA correctly)'
				: '';
			throw new Error(`[PowerSync upload] PATCH failed for ${tableRef}#${rowId}: ${error.message}${hint}`);
		}
		return;
	}

	if (op.op === 'DELETE') {
    // Monitoring: Log if a shift is deleted unexpectedly
    if (target.table === 'shifts') {
      try {
        const { insertAuditLog } = await import('@/services/audit.service');
        void insertAuditLog({
          action: 'DELETE',
          tableName: 'shifts',
          recordId: rowId,
          description: `Shift deleted (monitor): shiftId=${rowId}`,
        });
      } catch (err) {
        // Logging import or call failure should not block delete
      }
    }
    const { error } = await schemaClient.from(target.table).delete().eq('id', rowId);
    if (error) {
      const hint = error.message.toLowerCase().includes('invalid schema')
        ? ' (hint: add this schema to Supabase API Exposed schemas, or set EXPO_PUBLIC_SUPABASE_DB_SCHEMA correctly)'
        : '';
      throw new Error(`[PowerSync upload] DELETE failed for ${tableRef}#${rowId}: ${error.message}${hint}`);
    }
    return;
  }

	throw new Error(`[PowerSync upload] Unsupported CRUD operation: ${op.op}`);
}

/**
 * Returns true when the upload error is "unrecoverable" — the row will never be
 * accepted by the server in its current shape, so retrying forever just blocks
 * the upload queue. We drop the row locally and surface a one-shot warning to
 * the user (see lib/sync-warnings.ts).
 *
 * Common cases:
 *   - integer id sent to a uuid column (legacy pre-UUID-migration ghost rows)
 *   - uuid sent to a (still-)integer column (migration not yet applied)
 *   - other type-cast failures
 *   - FK violation pointing at a row that does not exist anywhere
 */
function isUnrecoverableUploadError(message: string): boolean {
	const m = message.toLowerCase();
	return (
		m.includes('invalid input syntax for type uuid') ||
		m.includes('invalid input syntax for type integer') ||
		m.includes('invalid input syntax for type bigint') ||
		m.includes('invalid input syntax for type numeric') ||
		m.includes('invalid input syntax for type timestamp') ||
		m.includes('column') && m.includes('does not exist') ||
		m.includes('value too long for type') ||
		m.includes('violates foreign key constraint')
	);
}

/**
 * Best-effort: delete the offending row from the local SQLite so PowerSync
 * stops retrying it. The op is also implicitly cleared when the surrounding
 * batch.complete() runs without rethrow.
 *
 * Some tables use `device_uid` or `id` as PK locally; we attempt both safely.
 */
async function deleteLocalRow(
	database: AbstractPowerSyncDatabase,
	table: string,
	id: string,
): Promise<void> {
	const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');
	if (!safeTable) return;
	try {
		await database.execute(`DELETE FROM ${safeTable} WHERE id = ?`, [id]);
	} catch (err) {
		console.warn(`[PowerSync upload] Local cleanup of ${safeTable}#${id} failed:`, err);
	}
	if (safeTable === 'devices') {
		try {
			await database.execute(`DELETE FROM devices WHERE device_uid = ?`, [id]);
		} catch {
			/* ignore */
		}
	}
}

export const powerSyncConnector: PowerSyncBackendConnector = {
	fetchCredentials: async () => {
		try {
			const endpoint = getPowerSyncEndpoint();

			if (!endpoint) {
				throw new Error('PowerSync endpoint not configured');
			}

			const { data: { session } } = await supabase.auth.getSession();

			if (!session) {
				return null;
			}

			// If the token is expired or about to expire within 60s, force a refresh.
			// getSession() returns the cached session and won't refresh an already-expired token,
			// so we need to explicitly call refreshSession() when PowerSync detects expiry.
			const expiresAt = (session.expires_at ?? 0) * 1000;
			let token = session.access_token;

			if (expiresAt < Date.now() + 60_000) {
				addBreadcrumb('sync', 'PowerSync credential refresh');
				const { data } = await supabase.auth.refreshSession();
				if (!data.session) {
					return null;
				}
				token = data.session.access_token;
			}

			return { endpoint, token };
		} catch (error) {
			captureError(error, { module: 'powersync', operation: 'fetchCredentials', level: 'error' });
			throw error;
		}
	},

	uploadData: async (database) => {
		return startSpan({ name: 'sync.upload', op: 'db.powersync' }, async () => {
		const batch = await database.getCrudBatch(100);

		if (!batch) {
			return;
		}

		for (const op of batch.crud as unknown as CrudOp[]) {
			try {
				await applyCrudOperation(op);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				if (isUnrecoverableUploadError(message)) {
					// Drop the row locally so the queue can drain, surface a
					// Sentry error + one-shot user prompt asking them to reset.
					await deleteLocalRow(database, op.table, op.id);
					notifyUnrecoverableUpload({
						table: op.table,
						id: op.id,
						op: op.op,
						reason: message,
					});
					addBreadcrumb('sync', `Dropped unrecoverable ${op.op} ${op.table}#${op.id}`);
					continue;
				}

				captureError(error, { module: 'powersync', operation: 'uploadData', level: 'error', extras: { table: op.table, opType: op.op, recordId: op.id } });
				throw error;
			}
		}

		await batch.complete();
		}); // end sync.upload span
	},
};
