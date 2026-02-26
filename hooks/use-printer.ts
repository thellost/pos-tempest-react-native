import { useCallback, useEffect, useState } from 'react';

import {
    type PaperWidth,
    type PrinterConfig,
    type PrinterSettings,
    type PrinterType,
    clearPrinter,
    getPrinterSettings,
    setPaperWidth,
    setPrinter,
} from '@/lib/printer';

export type { PaperWidth, PrinterConfig, PrinterType };

/**
 * Hook that loads printer settings from AsyncStorage and exposes helpers to
 * update them.  Components that display printer status or configuration use
 * this hook.
 */
export function usePrinter() {
  const [settings, setSettings] = useState<PrinterSettings>({
    kitchenPrinter: null,
    cashierPrinter: null,
    paperWidth: '80mm',
  });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await getPrinterSettings();
      setSettings(s);
    } catch (error) {
      console.error('[usePrinter] Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Pair or replace a printer. Pass null to clear. */
  const updatePrinter = useCallback(
    async (type: PrinterType, config: PrinterConfig | null) => {
      if (config) {
        await setPrinter(type, config);
      } else {
        await clearPrinter(type);
      }
      await load();
    },
    [load],
  );

  /** Change paper width (58mm / 80mm). */
  const updatePaperWidth = useCallback(
    async (width: PaperWidth) => {
      await setPaperWidth(width);
      await load();
    },
    [load],
  );

  return {
    settings,
    isLoading,
    refresh: load,
    updatePrinter,
    updatePaperWidth,
    kitchenPrinter: settings.kitchenPrinter,
    cashierPrinter: settings.cashierPrinter,
    paperWidth: settings.paperWidth,
  };
}
