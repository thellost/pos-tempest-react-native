import { PowerSyncContext } from '@powersync/react';
import Constants from 'expo-constants';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type PowerSyncRuntimeState = {
  available: boolean;
  ready: boolean;
  reason: string | null;
};

const PowerSyncRuntimeContext = createContext<PowerSyncRuntimeState>({
  available: false,
  ready: false,
  reason: null,
});

export function usePowerSyncRuntime() {
  return useContext(PowerSyncRuntimeContext);
}

export function PowerSyncProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [db, setDb] = useState<any | null>(null);

  useEffect(() => {
    const isExpoGo = Constants.executionEnvironment === 'storeClient';

    if (isExpoGo) {
      setAvailable(false);
      setReason('PowerSync native SQLite demo requires a development build (not Expo Go).');
      setReady(true);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const module = await import('@/lib/powersync');
        await module.initializePowerSync();

        if (!mounted) return;
        setDb(module.powersync);
        setAvailable(true);
        setReady(true);
      } catch (e: unknown) {
        if (!mounted) return;
        setAvailable(false);
        setReason(
          e instanceof Error
            ? `PowerSync unavailable: ${e.message}`
            : 'PowerSync unavailable in current runtime.'
        );
        setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const runtime = useMemo<PowerSyncRuntimeState>(
    () => ({
      available,
      ready,
      reason,
    }),
    [available, ready, reason]
  );

  if (!ready) {
    return (
      <PowerSyncRuntimeContext.Provider value={runtime}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.message}>Preparing local database…</Text>
        </View>
      </PowerSyncRuntimeContext.Provider>
    );
  }

  if (available && db) {
    return (
      <PowerSyncRuntimeContext.Provider value={runtime}>
        <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>
      </PowerSyncRuntimeContext.Provider>
    );
  }

  return <PowerSyncRuntimeContext.Provider value={runtime}>{children}</PowerSyncRuntimeContext.Provider>;
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
