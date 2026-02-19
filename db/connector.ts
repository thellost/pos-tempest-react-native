import type { PowerSyncBackendConnector } from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

function getPowerSyncEndpoint() {
	const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
	return endpoint && endpoint.trim().length > 0 ? endpoint : null;
}

export const powerSyncConnector: PowerSyncBackendConnector = {
	fetchCredentials: async () => {
		const session = await supabase.auth.getSession();
  
		if (!session.data.session) {
			throw new Error('Could not fetch credentials');
		}

		const endpoint = getPowerSyncEndpoint();
		if (!endpoint) {
			throw new Error('PowerSync endpoint not configured');
		}

		return {
			endpoint,
			token: session.data.session.access_token,
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
