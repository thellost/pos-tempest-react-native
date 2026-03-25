/**
 * Runtime configuration hook.
 *
 * Keeps `constants/config.ts` as the source-of-truth for defaults.
 * User overrides are persisted to AsyncStorage and layered on top at runtime.
 *
 * Usage:
 *   const { config, updateConfig, resetConfig } = useConfig();
 *   config.ORDER_PREFIX   // 'ORD' or whatever the user set
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '@/constants/config';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = '@pos_tempest/config_overrides';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Keys that can be overridden through the Settings UI */
export type EditableConfigKey =
  | 'IDLE_TIMEOUT_MS'
  | 'MAX_SESSION_DURATION_HOURS'
  | 'ORDER_PREFIX'
  | 'TICKET_PREFIX'
  | 'CURRENCY'
  | 'TIMEZONE';

type ConfigOverrides = Partial<Pick<typeof Config, EditableConfigKey>>;
type ResolvedConfig = typeof Config;

interface ConfigContextValue {
  config: ResolvedConfig;
  overrides: ConfigOverrides;
  isLoading: boolean;
  updateConfig: <K extends EditableConfigKey>(key: K, value: (typeof Config)[K]) => Promise<void>;
  resetConfig: (key?: EditableConfigKey) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ConfigContext = createContext<ConfigContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<ConfigOverrides>({});
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setOverrides(JSON.parse(raw));
          } catch {
            // corrupt data — ignore and use defaults
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const updateConfig = useCallback(
    async <K extends EditableConfigKey>(key: K, value: (typeof Config)[K]) => {
      const next = { ...overrides, [key]: value };
      setOverrides(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    [overrides]
  );

  const resetConfig = useCallback(
    async (key?: EditableConfigKey) => {
      if (key) {
        const next = { ...overrides };
        delete next[key];
        setOverrides(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        setOverrides({});
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    },
    [overrides]
  );

  // Merge defaults with overrides — overrides win
  const config: ResolvedConfig = { ...Config, ...overrides };

  return (
    <ConfigContext.Provider value={{ config, overrides, isLoading, updateConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider');
  return ctx;
}
