import type { PowerSyncBackendConnector } from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

function getPowerSyncEndpoint() {
	const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
	return endpoint && endpoint.trim().length > 0 ? endpoint : null;
}

export const powerSyncConnector: PowerSyncBackendConnector = {
	fetchCredentials: async () => {
		const endpoint = getPowerSyncEndpoint();
		const explicitToken = process.env.EXPO_PUBLIC_POWERSYNC_TOKEN;

		if (!endpoint) {
			return null;
		}

		if (explicitToken && explicitToken.trim().length > 0) {
			return {
				endpoint,
				token: explicitToken,
			};
		}

		const {
			data: { session },
		} = await supabase.auth.getSession();

		if (!session?.access_token) {
			return null;
		}

		return {
			endpoint,
			token: session.access_token,
		};
	},

	uploadData: async (database) => {
		const batch = await database.getCrudBatch(100);

		if (!batch) {
			return;
		}

		await batch.complete('noop-checkpoint');
	},
};
