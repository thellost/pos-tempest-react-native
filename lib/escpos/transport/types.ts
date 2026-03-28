/**
 * lib/escpos/transport/types.ts
 *
 * Transport interface for the ESC/POS library.
 *
 * A transport is responsible for moving bytes from this device to a printer.
 * It knows nothing about receipts, commands, or formatting — only bytes in,
 * acknowledgement out.
 *
 * This interface is intentionally minimal so alternative transports
 * (TCP, USB, Wi-Fi) can be added without touching the core library.
 */

// ── PrintTransport ────────────────────────────────────────────────────────────

export interface PrintTransport {
  /**
   * Send a complete ESC/POS byte payload to the printer.
   *
   * Implementations are responsible for:
   * - Establishing a connection if not already open
   * - Sending the bytes (chunked if necessary)
   * - Disconnecting / releasing resources after the send
   *
   * Throws on connection failure or write error.
   */
  send(bytes: Uint8Array): Promise<void>;

  /**
   * Explicitly disconnect from the printer.
   * Safe to call even if already disconnected — must not throw.
   */
  disconnect(): Promise<void>;
}

// ── Options ───────────────────────────────────────────────────────────────────

export interface TransportOptions {
  /**
   * Maximum bytes sent per write call.
   * Bluetooth Classic SPP can silently drop data if you send too much at once.
   * Default: 512 bytes
   */
  chunkSize?: number;

  /**
   * Milliseconds to wait between consecutive chunk writes.
   * Gives the printer time to process each chunk before receiving the next.
   * Default: 50 ms
   */
  chunkDelayMs?: number;

  /**
   * Milliseconds to wait for a Bluetooth connection before giving up.
   * Default: 10 000 ms (10 s)
   */
  connectTimeoutMs?: number;
}
