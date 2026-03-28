/**
 * lib/escpos/transport/bluetooth.ts
 *
 * Layer 3 — Bluetooth Classic transport.
 *
 * Sends a Uint8Array to a paired Bluetooth printer over the Serial Port
 * Profile (SPP) using react-native-bluetooth-classic.
 *
 * Design:
 * - Each send() call opens a fresh connection, writes all bytes in chunks,
 *   then disconnects.  No persistent connection state is held between calls.
 * - sendInChunks() is exported as a standalone utility for callers that
 *   manage their own BluetoothDevice lifecycle.
 * - Connection has a configurable timeout via Promise.race so a hung connect
 *   never blocks the UI indefinitely.
 *
 * Usage:
 *   import { BluetoothTransport } from '@/lib/escpos'
 *
 *   const transport = new BluetoothTransport('AA:BB:CC:DD:EE:FF')
 *   await transport.send(bytes)         // connect → chunk-write → disconnect
 */

import { Buffer } from 'buffer';
import BluetoothClassic, { type BluetoothDevice } from 'react-native-bluetooth-classic';

import type { PrintTransport, TransportOptions } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE       = 512;
const DEFAULT_CHUNK_DELAY_MS   = 50;
const DEFAULT_CONNECT_TIMEOUT  = 10_000;

// ── BluetoothTransport ────────────────────────────────────────────────────────

export class BluetoothTransport implements PrintTransport {
  private readonly _mac: string;
  private readonly _chunkSize: number;
  private readonly _chunkDelayMs: number;
  private readonly _connectTimeoutMs: number;

  /** Held only during an active send() call; null otherwise. */
  private _device: BluetoothDevice | null = null;

  /**
   * @param address  Printer MAC address.
   *                 Accepts both raw form `AA:BB:CC:DD:EE:FF`
   *                 and Epson SDK form `BT:AA:BB:CC:DD:EE:FF`.
   */
  constructor(address: string, options?: TransportOptions) {
    this._mac = normalizeMac(address);
    this._chunkSize      = options?.chunkSize       ?? DEFAULT_CHUNK_SIZE;
    this._chunkDelayMs   = options?.chunkDelayMs    ?? DEFAULT_CHUNK_DELAY_MS;
    this._connectTimeoutMs = options?.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;
  }

  /**
   * Connects to the printer, sends `bytes` in chunks, then disconnects.
   * Disconnects even if the write throws.
   *
   * @throws Error  if the connection times out or the write fails.
   */
  async send(bytes: Uint8Array): Promise<void> {
    this._device = await connectWithTimeout(this._mac, this._connectTimeoutMs);

    try {
      await sendInChunks(this._device, bytes, this._chunkSize, this._chunkDelayMs);
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Disconnects from the printer.
   * Safe to call when already disconnected — never throws.
   */
  async disconnect(): Promise<void> {
    if (this._device !== null) {
      await this._device.disconnect().catch(() => {});
      this._device = null;
    }
  }
}

// ── sendInChunks ──────────────────────────────────────────────────────────────

/**
 * Writes a Uint8Array to an already-connected BluetoothDevice in fixed-size
 * chunks with a short delay between each chunk.
 *
 * Why chunking?
 * Bluetooth Classic SPP has a limited internal buffer (~512 bytes on most
 * Android devices). Sending the entire payload in one write causes silent
 * data loss on large receipts.  Chunking + a short delay lets the printer's
 * receive buffer drain before the next chunk arrives.
 *
 * @param device      Connected BluetoothDevice
 * @param buffer      Bytes to send
 * @param chunkSize   Bytes per write call (default 512)
 * @param delayMs     ms between consecutive writes (default 50)
 */
export async function sendInChunks(
  device: BluetoothDevice,
  buffer: Uint8Array,
  chunkSize = DEFAULT_CHUNK_SIZE,
  delayMs   = DEFAULT_CHUNK_DELAY_MS,
): Promise<void> {
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const slice = buffer.subarray(offset, offset + chunkSize);
    // BluetoothDevice.write() accepts Buffer, not Uint8Array
    await device.write(Buffer.from(slice));

    // Delay between chunks — skip after the last chunk
    const isLast = offset + chunkSize >= buffer.length;
    if (!isLast && delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Normalises a printer address to a bare MAC string.
 * Strips the "BT:" prefix used by the Epson ePOS SDK.
 *
 * "BT:AA:BB:CC:DD:EE:FF" → "AA:BB:CC:DD:EE:FF"
 * "AA:BB:CC:DD:EE:FF"    → "AA:BB:CC:DD:EE:FF"
 */
export function normalizeMac(address: string): string {
  return address.replace(/^BT:/i, '');
}

/**
 * Connects to a Bluetooth device with a hard timeout.
 * If the connection is not established within `timeoutMs` milliseconds,
 * the returned promise rejects with a descriptive error.
 *
 * react-native-bluetooth-classic's connectToDevice() can hang indefinitely
 * when the target device is powered off or out of range — this prevents that.
 */
async function connectWithTimeout(
  mac: string,
  timeoutMs: number,
): Promise<BluetoothDevice> {
  // Hold the timer ID outside both promises so the success path can clear it.
  // Without this, a dangling setTimeout fires after every successful connect
  // and silently rejects a promise no one is listening to.
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const connectPromise = BluetoothClassic.connectToDevice(mac).then((device) => {
    clearTimeout(timerId);
    return device;
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new Error(
          `[escpos] Bluetooth connect timed out after ${timeoutMs}ms (${mac})`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([connectPromise, timeoutPromise]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
