/**
 * lib/bluetooth.ts
 *
 * Bluetooth thermal printer utility library.
 * Wraps react-native-esc-pos-printer (Epson ePOS SDK) for Epson printers.
 * Falls back to raw SPP via react-native-bluetooth-classic for generic
 * ESC/POS printers (e.g. Rongta, Xprinter) that reject the Epson SDK's
 * proprietary UUID handshake (ERR_CONNECT).
 *
 * Bluetooth target address format: "BT:AA:BB:CC:DD:EE:FF"
 */
import { Buffer } from 'buffer';
import {
  Printer,
  PrintersDiscovery,
  DiscoveryPortType,
  PrinterModelLang,
  PrinterAddPulseDrawerType,
  PrinterAddPulseTimeType,
} from 'react-native-esc-pos-printer';
import BluetoothClassic from 'react-native-bluetooth-classic';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import { Config } from '@/constants/config';
import { addBreadcrumb, captureError } from '@/lib/sentry';
import { normalizeMac } from '@/lib/escpos/transport/bluetooth';

const BT_ADDRESS_RE = /^BT:[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveredPrinter {
  /** Bluetooth target address, e.g. "BT:AA:BB:CC:DD:EE:FF" */
  target: string;
  name: string;
  deviceType?: string;
}

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

// ── Bonded devices (paired in system BT settings, any brand) ─────────────────

/**
 * Returns all Bluetooth devices already paired in Android system settings.
 * Works for any brand (Rongta, Epson, etc.) — no active scanning, no PIN prompts.
 * Converts MAC addresses to Epson ePOS SDK target format: "BT:AA:BB:CC:DD:EE:FF"
 */
export async function getBondedPrinters(): Promise<{ printers: DiscoveredPrinter[]; error?: string }> {
  // Android 12+ requires BLUETOOTH_CONNECT at runtime
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // Permanently denied — send user to app settings
      Linking.openSettings();
      return { printers: [], error: 'Bluetooth permission is blocked. Enable it in app settings.' };
    }
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return { printers: [], error: 'Bluetooth permission denied.' };
    }
  }

  try {
    const devices = await BluetoothClassic.getBondedDevices();
    return {
      printers: devices.map((d) => ({
        target: `BT:${d.address}`,
        name: d.name ?? d.address,
      })),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load paired devices';
    return { printers: [], error: msg };
  }
}

/**
 * Opens the system Bluetooth settings screen.
 */
export function openBluetoothSettings(): void {
  BluetoothClassic.openBluetoothSettings();
}

// ── Timeouts ──────────────────────────────────────────────────────────────────

const CONNECT_TIMEOUT_MS = Config.BT_CONNECT_TIMEOUT_MS;
const SEND_TIMEOUT_MS    = Config.BT_SEND_TIMEOUT_MS;
const PING_TIMEOUT_MS    = Config.BT_PING_TIMEOUT_MS;

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
  timeoutMs = Config.BT_SCAN_TIMEOUT_MS,
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
    if (status === 'inactive') {
      onStatus?.('done');
      addBreadcrumb('print', 'Bluetooth scan done', { found: found.length });
    } else if (status === 'discovering') {
      onStatus?.('scanning');
    }
  });

  const removeError = PrintersDiscovery.onError((err) => {
    onStatus?.('error');
    const msg = err?.message ?? 'Discovery failed';
    onError?.(msg);
    addBreadcrumb('print', 'Bluetooth scan error', { error: msg }, 'error');
  });

  onStatus?.('scanning');
  addBreadcrumb('print', 'Bluetooth scan started', { timeoutMs });

  PrintersDiscovery.start({
    timeout: timeoutMs,
    autoStop: true,
    filterOption: { portType: DiscoveryPortType.PORTTYPE_BLUETOOTH },
  }).catch((err: Error) => {
    onStatus?.('error');
    const msg = err?.message ?? 'Failed to start Bluetooth scan';
    onError?.(msg);
    captureError(err, { module: 'bluetooth', operation: 'scanBluetoothPrinters', extras: { msg } });
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
/**
 * Sends raw ESC/POS bytes to a generic Bluetooth printer via the standard
 * SPP profile (react-native-bluetooth-classic).
 *
 * Use this for non-Epson printers (e.g. Rongta, Xprinter) that reject the
 * Epson ePOS SDK connection — this goes straight over the standard SPP UUID.
 *
 * @param address  BT:AA:BB:CC:DD:EE:FF  or  raw MAC  AA:BB:CC:DD:EE:FF
 * @param rawText  Plain-text content to print (ESC/POS init + cut appended)
 */
export async function runRawPrinterJob(
  address: string,
  rawText: string,
): Promise<void> {
  const mac = normalizeMac(address);
  console.log(`[printer] runRawPrinterJob (SPP) — mac="${mac}"`);
  addBreadcrumb('print', 'Raw SPP job started', { mac });

  // Build payload: init + content + 5 line-feeds + GS V A 0 (partial cut)
  const init  = Buffer.from([0x1B, 0x40]);                    // ESC @
  const feeds = Buffer.from([0x0A, 0x0A, 0x0A, 0x0A, 0x0A]); // 5× LF
  const cut   = Buffer.from([0x1D, 0x56, 0x41, 0x00]);        // GS V A 0
  const text  = Buffer.from(rawText, 'utf8');
  const payload = Buffer.concat([init, text, feeds, cut]);

  const device = await BluetoothClassic.connectToDevice(mac);
  console.log('[printer] Raw SPP connected');
  try {
    await device.write(payload);
    console.log('[printer] Raw SPP write complete');
    addBreadcrumb('print', 'Raw SPP job success', { mac });
  } catch (err) {
    console.error('[printer] runRawPrinterJob write error:', err);
    captureError(err, { module: 'bluetooth', operation: 'runRawPrinterJob', extras: { mac } });
    throw err;
  } finally {
    await device.disconnect().catch(() => {});
  }
}

export async function runPrinterJob(
  address: string,
  name: string,
  buildFn: (printer: Printer) => Promise<void>,
  /** Fallback plain-text used when the Epson SDK returns ERR_CONNECT (non-Epson printer). */
  rawFallback?: string,
): Promise<void> {
  const isBtFormat = BT_ADDRESS_RE.test(address);
  console.log(`[printer] runPrinterJob — target="${address}" name="${name}" btFormat=${isBtFormat}`);
  addBreadcrumb('print', 'Printer job started', { address, name, isBtFormat });

  if (!isBtFormat) {
    console.warn(`[printer] Address "${address}" is NOT in BT:AA:BB:CC:DD:EE:FF format — connect will likely fail`);
  }

  const printer = new Printer({
    target: address,
    deviceName: name,
    lang: PrinterModelLang.MODEL_ANK,
  });

  await printer.addQueueTask(async () => {
    let usedFallback = false;
    try {
      console.log(`[printer] Connecting… (timeout ${CONNECT_TIMEOUT_MS}ms)`);
      await printer.connect(CONNECT_TIMEOUT_MS);
      console.log('[printer] Connected — building job');
      await buildFn(printer);
      console.log(`[printer] Sending data… (timeout ${SEND_TIMEOUT_MS}ms)`);
      await printer.sendData(SEND_TIMEOUT_MS);
      console.log('[printer] sendData complete');
      addBreadcrumb('print', 'Printer job success', { address });
    } catch (err) {
      const status =
        err != null && typeof err === 'object' && 'status' in err
          ? (err as { status: string }).status
          : null;
      const methodName =
        err != null && typeof err === 'object' && 'methodName' in err
          ? (err as { methodName: string }).methodName
          : null;

      if (status != null) {
        console.warn(
          `[printer] PrinterError — status="${status}" methodName="${methodName}" address="${address}"`,
        );
      } else {
        console.error('[printer] Non-PrinterError in runPrinterJob:', err);
      }

      // ERR_CONNECT means the Epson SDK couldn't open the BT socket — this
      // happens with non-Epson printers that use a different SPP UUID.
      // Fall back to raw SPP if the caller supplied fallback text.
      if (status === 'ERR_CONNECT' && rawFallback != null) {
        console.warn('[printer] ERR_CONNECT — falling back to raw SPP path');
        usedFallback = true;
        await runRawPrinterJob(address, rawFallback);
        return;
      }

      captureError(err, {
        module: 'bluetooth',
        operation: 'runPrinterJob',
        extras: { address, name, isBtFormat },
      });
      throw err;
    } finally {
      if (!usedFallback) {
        await printer.disconnect().catch(() => {});
      }
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
  addBreadcrumb('print', 'Cash drawer pulse sending', { address, name });
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
  const isBtFormat = BT_ADDRESS_RE.test(address);
  console.log(`[printer] ping — target="${address}" btFormat=${isBtFormat}`);
  addBreadcrumb('print', 'Bluetooth ping', { address, isBtFormat });

  const printer = new Printer({
    target: address,
    deviceName: name,
    lang: PrinterModelLang.MODEL_ANK,
  });

  try {
    await printer.connect(PING_TIMEOUT_MS);
    await printer.getStatus();
    console.log('[printer] ping success');
    addBreadcrumb('print', 'Bluetooth ping success', { address });
    return true;
  } catch (err) {
    const isPrinterError = err != null && typeof err === 'object' && 'status' in err && 'methodName' in err;
    if (isPrinterError) {
      const pe = err as { status: string; methodName: string; message: string };
      console.warn(
        `[printer] ping failed — message="${pe.message}" status="${pe.status}" methodName="${pe.methodName}" address="${address}"`,
      );
    } else {
      console.warn('[printer] ping failed (non-PrinterError):', err);
    }
    addBreadcrumb('print', 'Bluetooth ping failed', { address }, 'warning');
    captureError(err, { module: 'bluetooth', operation: 'pingBluetoothPrinter', extras: { address, name, isBtFormat }, level: 'warning' });
    return false;
  } finally {
    await printer.disconnect().catch(() => {});
  }
}
