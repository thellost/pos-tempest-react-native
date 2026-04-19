import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import * as Updates from 'expo-updates';

import { addBreadcrumb } from '@/lib/sentry';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OtaUpdateState {
  /** Currently checking the server for a new update */
  isChecking: boolean;
  /** Downloading an available update */
  isDownloading: boolean;
  /** A new update has been downloaded and is ready to apply */
  isReady: boolean;
  /** Last error encountered during check/download */
  error: Error | null;
}

interface UseOtaUpdateReturn extends OtaUpdateState {
  /** Reload the app to apply the downloaded update */
  restart: () => Promise<void>;
  /** Manually trigger an update check */
  checkForUpdate: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Checks for OTA updates on mount and whenever the app returns to
 * the foreground.  Downloads in the background and exposes `isReady`
 * when the update can be applied with `restart()`.
 *
 * Safe to use in dev builds — all checks are skipped when `__DEV__`
 * is true or expo-updates is not enabled.
 */
export function useOtaUpdate(): UseOtaUpdateReturn {
  const [state, setState] = useState<OtaUpdateState>({
    isChecking: false,
    isDownloading: false,
    isReady: false,
    error: null,
  });

  const isRunning = useRef(false);

  const checkForUpdate = useCallback(async () => {
    // Skip in dev or when expo-updates is not available
    if (__DEV__ || !Updates.isEnabled) return;
    // Prevent concurrent checks
    if (isRunning.current) return;
    isRunning.current = true;

    try {
      setState((s) => ({ ...s, isChecking: true, error: null }));
      addBreadcrumb('ota', 'Checking for OTA update');

      const check = await Updates.checkForUpdateAsync();

      if (!check.isAvailable) {
        addBreadcrumb('ota', 'No update available');
        setState((s) => ({ ...s, isChecking: false }));
        return;
      }

      addBreadcrumb('ota', 'Update available, downloading');
      setState((s) => ({ ...s, isChecking: false, isDownloading: true }));

      await Updates.fetchUpdateAsync();

      addBreadcrumb('ota', 'Update downloaded and ready');
      setState((s) => ({ ...s, isDownloading: false, isReady: true }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      addBreadcrumb('ota', 'Update check/download failed', { error: error.message }, 'error');
      setState((s) => ({ ...s, isChecking: false, isDownloading: false, error }));
    } finally {
      isRunning.current = false;
    }
  }, []);

  const restart = useCallback(async () => {
    if (!state.isReady) return;
    addBreadcrumb('ota', 'Restarting app to apply update');
    await Updates.reloadAsync();
  }, [state.isReady]);

  // Check on mount
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  // Check when app returns to foreground
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        checkForUpdate();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [checkForUpdate]);

  return { ...state, restart, checkForUpdate };
}
