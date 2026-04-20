import type { PowerSyncBackendConnector } from '@powersync/react-native';

import { addBreadcrumb, captureError, startSpan } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

function getPowerSyncEndpoint() {
	const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
	return endpoint && endpoint.trim().length > 0 ? endpoint : null;
}

function getSupabaseWriteSchema() {
	const schema = process.env.EXPO_PUBLIC_SUPABASE_DB_SCHEMA;
	// generate warning if schema is not set, as this is a common misconfiguration that can lead to upload failures
	if (!schema || schema.trim().length === 0) {
		console.warn('[PowerSync Connector] Warning: EXPO_PUBLIC_SUPABASE_DB_SCHEMA is not set. Defaulting to "public". This may cause upload failures if your tables are not in the public schema.');
	}
	return schema && schema.trim().length > 0 ? schema.trim() : 'public';
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
				captureError(error, { module: 'powersync', operation: 'uploadData', level: 'error', extras: { table: op.table, opType: op.op, recordId: op.id } });
				throw error;
			}
		}

		await batch.complete();
		}); // end sync.upload span
	},
};
