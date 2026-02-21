import type { PowerSyncBackendConnector } from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

function getPowerSyncEndpoint() {
	const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
	return endpoint && endpoint.trim().length > 0 ? endpoint : null;
}

function getSupabaseWriteSchema() {
	const schema = process.env.EXPO_PUBLIC_SUPABASE_DB_SCHEMA;
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
		const session = await supabase.auth.getSession();
		const token = session.data.session?.access_token;
		const endpoint = getPowerSyncEndpoint();
  
		if (!endpoint) {
			throw new Error('PowerSync endpoint not configured');
		}

		if (!token) {
			// Per PowerSync connector contract, return null when user is not signed in.
			return null;
		}

		return {
			endpoint,
			token,
		};
	},

	uploadData: async (database) => {
		const batch = await database.getCrudBatch(100);

		if (!batch) {
			return;
		}

		for (const op of batch.crud as unknown as CrudOp[]) {
			await applyCrudOperation(op);
		}

		await batch.complete();
	},
};
