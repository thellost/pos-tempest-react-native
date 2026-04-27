import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { PowerSyncContext } from '@powersync/react';
import { PowerSyncDatabase } from '@powersync/react-native';
import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { powerSyncConnector } from '@/db/connector';
import { appSchema } from '@/db/schema';
import { addBreadcrumb } from '@/lib/sentry';

export const powersync = new PowerSyncDatabase({
	database: new OPSqliteOpenFactory({
		dbFilename: 'postempest.db',
	}),
	schema: appSchema,
});

let initPromise: Promise<void> | null = null;
const POWERSYNC_ENVIRONMENT = __DEV__ ? 'development' : 'production';

/**
 * Wipes all locally cached PowerSync data and resets the sync state.
 * The schema is preserved; on the next `connect()` the database is
 * re-hydrated from the backend. Intended for one-shot recovery after a
 * backend schema migration (e.g. UUID PK rollout) that left local rows
 * incompatible with the server. Caller is responsible for signing the
 * user out and routing back to login.
 */
export async function resetLocalData(): Promise<void> {
	const timestamp = new Date().toISOString();
	addBreadcrumb('sync', `PowerSync RESET at ${timestamp}`);
	try {
		await powersync.disconnectAndClear();
		initPromise = null;
		console.log(`[PowerSync] Local data reset complete at ${timestamp}`);
	} catch (error) {
		console.error('[PowerSync] Failed to reset local data:', error);
		throw error;
	}
}

export function getPowerSyncStatusSnapshot() {
	const status = powersync.currentStatus;

	return {
		connected: status.connected,
		connecting: status.connecting,
		hasSynced: status.hasSynced,
		downloading: Boolean(status.dataFlowStatus?.downloading),
		uploading: Boolean(status.dataFlowStatus?.uploading),
		lastSyncedAt: status.lastSyncedAt ? status.lastSyncedAt.toISOString() : null,
	};
}

export async function initializePowerSync() {
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		try {
			await powersync.init();

			if (process.env.EXPO_PUBLIC_POWERSYNC_URL) {
				await powersync.connect(powerSyncConnector, {
					params: { environment: POWERSYNC_ENVIRONMENT },
				});

				// Log PowerSync SYNC event
				const syncTimestamp = new Date().toISOString();
				addBreadcrumb('sync', `PowerSync SYNC at ${syncTimestamp}`);
				console.log(`[PowerSync] Sync event at ${syncTimestamp}`);
			}
		} catch (error) {
			initPromise = null;
			console.error('[PowerSync] Failed to initialize or connect:', error);
			throw error;
		}
	})();

	return initPromise;
}
export function PowerSyncProvider({ children }: PropsWithChildren) {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let dispose: (() => void) | undefined;

		initializePowerSync()
			.then(() => {
				setReady(true);
				dispose = powersync.registerListener({
					statusChanged: (status) => {
						addBreadcrumb('sync', `PowerSync ${status.connected ? 'connected' : 'disconnected'}`, {
							connected: status.connected,
							lastSyncedAt: status.lastSyncedAt,
						});
					},
				});
			})
			.catch((e: unknown) => {
				console.error('[PowerSyncProvider] Initialization failed:', e);
				setError(e instanceof Error ? e.message : 'PowerSync initialization failed');
			});

		return () => {
			dispose?.();
		};
	}, []);

	if (error) {
		return (
			<View style={styles.center}>
				<Text style={styles.title}>PowerSync Error</Text>
				<Text style={styles.message}>{error}</Text>
			</View>
		);
	}

	if (!ready) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" />
				<Text style={styles.message}>Preparing local database…</Text>
			</View>
		);
	}

	return <PowerSyncContext.Provider value={powersync}>{children}</PowerSyncContext.Provider>;
}

const styles = StyleSheet.create({
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 20,
	},
	title: {
		fontSize: 18,
		fontWeight: '700',
	},
	message: {
		textAlign: 'center',
		opacity: 0.8,
	},
});
