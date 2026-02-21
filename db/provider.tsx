import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { PowerSyncContext } from '@powersync/react';
import { PowerSyncDatabase } from '@powersync/react-native';
import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { powerSyncConnector } from '@/db/connector';
import { appSchema } from '@/db/schema';

export const powersync = new PowerSyncDatabase({
	database: new OPSqliteOpenFactory({ dbFilename: 'postempest.db' }),
	schema: appSchema,
});

let initialized = false;
let connected = false;
let initPromise: Promise<void> | null = null;

export async function initializePowerSync() {
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		if (!initialized) {
			await powersync.init();
			initialized = true;
		}

		if (!connected && process.env.EXPO_PUBLIC_POWERSYNC_URL) {
			await powersync.connect(powerSyncConnector);
			connected = true;
		}
	})();

	return initPromise;
}
export function PowerSyncProvider({ children }: PropsWithChildren) {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		initializePowerSync()
			.then(() => setReady(true))
			.catch((e: unknown) => {
				connected = false;
				setError(e instanceof Error ? e.message : 'PowerSync initialization failed');
			});
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
