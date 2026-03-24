/**
 * lib/bluetooth.ts
 *
 * Bluetooth thermal printer utility library.
 * Wraps react-native-esc-pos-printer (Epson ePOS SDK).
 *
 * Bluetooth target address format: "BT:AA:BB:CC:DD:EE:FF"
 */
import {
  Printer,
  PrintersDiscovery,
  DiscoveryPortType,
  PrinterModelLang,
  PrinterAddPulseDrawerType,
  PrinterAddPulseTimeType,
} from 'react-native-esc-pos-printer';

import { addBreadcrumb, captureError } from '@/lib/sentry';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveredPrinter {
  /** Bluetooth target address, e.g. "BT:AA:BB:CC:DD:EE:FF" */
  target: string;
  name: string;
  deviceType?: string;
}

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

// ── Timeouts ──────────────────────────────────────────────────────────────────

const CONNECT_TIMEOUT_MS = 15_000;
const SEND_TIMEOUT_MS    = 10_000;
const PING_TIMEOUT_MS    =  8_000;

// ── Discovery ─────────────────────────────────────────────────────────────────

/**
 * Scans for nearby Bluetooth printers using the Epson ePOS SDK.
 *
 * @param onResults - Called each time new printers are found (cumulative list)
 * @param onStatus  - Called when scan status changes
 * @param onError   - Called on scan failure
 * @param timeoutMs - How long to scan before auto-stopping (default 10 s)
 * @returns Cleanup function — call to stop the scan and remove all listeners
 */
export function scanBluetoothPrinters(
  onResults: (printers: DiscoveredPrinter[]) => void,
  onStatus?: (status: ScanStatus) => void,
  onError?: (message: string) => void,
  timeoutMs = 10_000,
): () => void {
  const found: DiscoveredPrinter[] = [];

  const removeDiscovery = PrintersDiscovery.onDiscovery((printers: Array<{ target: string; name?: string; deviceType?: unknown }>) => {
    for (const p of printers) {
      if (!found.some((f) => f.target === p.target)) {
        found.push({
          target: p.target,
          name: p.name ?? p.target,
          deviceType: p.deviceType != null ? String(p.deviceType) : undefined,
        });
      }
    }
    onResults([...found]);
  });

  const removeStatus = PrintersDiscovery.onStatusChange((status: string) => {
    if (status === 'inactive') onStatus?.('done');
    else if (status === 'discovering') onStatus?.('scanning');
  });

  const removeError = PrintersDiscovery.onError((err) => {
    onStatus?.('error');
    const msg = err?.message ?? 'Discovery failed';
    onError?.(msg);
    addBreadcrumb('print', 'Bluetooth scan error', { error: msg }, 'error');
  });

  onStatus?.('scanning');

  PrintersDiscovery.start({
    timeout: timeoutMs,
    autoStop: true,
    filterOption: { portType: DiscoveryPortType.PORTTYPE_BLUETOOTH },
  }).catch((err: Error) => {
    onStatus?.('error');
    onError?.(err?.message ?? 'Failed to start Bluetooth scan');
  });

  return () => {
    removeDiscovery();
    removeStatus();
    removeError();
    PrintersDiscovery.stop().catch(() => {});
  };
}

/** Stops any active Bluetooth scan immediately. */
export function stopBluetoothScan(): void {
  PrintersDiscovery.stop().catch(() => {});
}

// ── Core Job Runner ───────────────────────────────────────────────────────────

/**
 * Core print job runner. Creates a Printer instance, queues the task so
 * concurrent calls are serialised, connects, runs the build function,
 * flushes data to the printer, then disconnects.
 *
 * Pass a `buildFn` that calls the printer's formatting methods:
 * addText, addTextAlign, addTextStyle, addTextSize, addCut, etc.
 *
 * @example
 *   await runPrinterJob('BT:AA:BB:CC:DD:EE:FF', 'My Printer', async (p) => {
 *     await p.addTextAlign(TextAlignType.ALIGN_CENTER);
 *     await p.addText('Hello!\n');
 *     await p.addFeedLine(3);
 *     await p.addCut(PrinterAddCutType.CUT_FEED);
 *   });
 */
export async function runPrinterJob(
  address: string,
  name: string,
  buildFn: (printer: Printer) => Promise<void>,
): Promise<void> {
  addBreadcrumb('print', 'Printer job started', { address, name });

  const printer = new Printer({
    target: address,
    deviceName: name,
    lang: PrinterModelLang.MODEL_ANK,
  });

  await printer.addQueueTask(async () => {
    try {
      await printer.connect(CONNECT_TIMEOUT_MS);
      await buildFn(printer);
      await printer.sendData(SEND_TIMEOUT_MS);
      addBreadcrumb('print', 'Printer job success', { address });
    } catch (err) {
      captureError(err, {
        module: 'bluetooth',
        operation: 'runPrinterJob',
        extras: { address, name },
      });
      throw err;
    } finally {
      await printer.disconnect().catch(() => {});
    }
  });
}

// ── Cash Drawer ───────────────────────────────────────────────────────────────

/**
 * Opens a cash drawer connected to a Bluetooth cashier printer via a 2-pin pulse.
 */
export async function openCashDrawerViaBluetooth(
  address: string,
  name: string,
): Promise<void> {
  await runPrinterJob(address, name, async (printer) => {
    await printer.addPulse({
      drawer: PrinterAddPulseDrawerType.DRAWER_2PIN,
      time: PrinterAddPulseTimeType.PULSE_200,
    });
  });
}

// ── Health Check ──────────────────────────────────────────────────────────────

/**
 * Pings a Bluetooth printer to verify it is reachable.
 * Returns `true` if the connection succeeded, `false` otherwise.
 */
export async function pingBluetoothPrinter(
  address: string,
  name: string,
): Promise<boolean> {
  addBreadcrumb('print', 'Bluetooth ping', { address });

  const printer = new Printer({
    target: address,
    deviceName: name,
    lang: PrinterModelLang.MODEL_ANK,
  });

  try {
    await printer.connect(PING_TIMEOUT_MS);
    await printer.getStatus();
    return true;
  } catch {
    return false;
  } finally {
    await printer.disconnect().catch(() => {});
  }
}
