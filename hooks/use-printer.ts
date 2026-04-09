import { useCallback, useEffect, useState } from 'react';

import { addBreadcrumb, captureError } from '@/lib/sentry';
import {
    type PaperWidth,
    type PrinterConfig,
    type PrinterSettings,
    type PrinterType,
    clearPrinter,
    getPrinterSettings,
    setPrinter,
    setPrinterPaperWidth,
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
  });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await getPrinterSettings();
      setSettings(s);
    } catch (error) {
      captureError(error, { module: 'printer', operation: 'load', level: 'warning' });
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
      try {
        if (config) {
          await setPrinter(type, config);
          addBreadcrumb('print', 'Printer configured', { type, address: config.address, name: config.name });
        } else {
          await clearPrinter(type);
          addBreadcrumb('print', 'Printer cleared', { type });
        }
        await load();
      } catch (error) {
        captureError(error, { module: 'printer', operation: 'updatePrinter', extras: { type } });
        throw error;
      }
    },
    [load],
  );

  /** Change paper width for a specific printer. */
  const updatePrinterPaperWidth = useCallback(
    async (type: PrinterType, width: PaperWidth) => {
      try {
        await setPrinterPaperWidth(type, width);
        addBreadcrumb('print', 'Paper width changed', { type, width });
        await load();
      } catch (error) {
        captureError(error, { module: 'printer', operation: 'updatePrinterPaperWidth', extras: { type, width } });
        throw error;
      }
    },
    [load],
  );

  return {
    settings,
    isLoading,
    refresh: load,
    updatePrinter,
    updatePrinterPaperWidth,
    kitchenPrinter: settings.kitchenPrinter,
    cashierPrinter: settings.cashierPrinter,
  };
}
