import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { PowerSyncContext } from '@powersync/react';
import { PowerSyncDatabase } from '@powersync/react-native';
import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { powerSyncConnector } from '@/db/connector';
import { appSchema } from '@/db/schema';
import { addBreadcrumb, captureMessage } from '@/lib/sentry';

export const powersync = new PowerSyncDatabase({
	database: new OPSqliteOpenFactory({
		dbFilename: 'postempest.db',
	}),
	schema: appSchema,
});

let initPromise: Promise<void> | null = null;

export async function initializePowerSync() {
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		try {
			await powersync.init();

			if (process.env.EXPO_PUBLIC_POWERSYNC_URL) {
				await powersync.connect(powerSyncConnector);
			}
		} catch (error) {
			// Reset so callers can retry
			initPromise = null;
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
				let connectedSince: number | null = null;
				dispose = powersync.registerListener({
					statusChanged: (status) => {
						addBreadcrumb('sync', `PowerSync ${status.connected ? 'connected' : 'disconnected'}`, {
							connected: status.connected,
							lastSyncedAt: status.lastSyncedAt,
						});

						if (status.connected) {
							if (connectedSince === null) connectedSince = Date.now();
						} else {
							connectedSince = null;
						}

						if (status.connected && status.lastSyncedAt && connectedSince !== null) {
							const minutesConnected = (Date.now() - connectedSince) / 60_000;
							const minutesStale = (Date.now() - new Date(status.lastSyncedAt).getTime()) / 60_000;
							if (minutesConnected > 5 && minutesStale > 5) {
								captureMessage('PowerSync stale — no sync for 5+ minutes while online', 'warning', {
									lastSyncedAt: status.lastSyncedAt,
									minutesStale: Math.round(minutesStale),
								});
							}
						}
					},
				});
			})
			.catch((e: unknown) => {
				setError(e instanceof Error ? e.message : 'PowerSync initialization failed');
			});

		return () => { dispose?.(); };
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
