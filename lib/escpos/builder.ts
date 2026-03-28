/**
 * lib/escpos/builder.ts
 *
 * Layer 1 — CommandBuilder
 *
 * A pure byte-accumulator that outputs a complete ESC/POS Uint8Array.
 * Contains zero React Native / I/O / Bluetooth logic.
 *
 * Every method returns `this` for chaining, mirroring common builder APIs:
 *
 *   const bytes = new CommandBuilder(profile)
 *     .init()
 *     .align('center')
 *     .bold(true)
 *     .text('My Store\n')
 *     .bold(false)
 *     .align('left')
 *     .feed(3)
 *     .cut()
 *     .build();
 */

import {
  CMD,
  ESC, GS, NUL, LF,
  BARCODE_TYPE_LEGACY,
  BARCODE_TYPE_MODERN,
  QR_CORRECTION,
} from './commands';
import { encode, codepageByte } from './encoder';
import type {
  PrinterProfile,
  Codepage,
  Align,
  TextSize,
  CutMode,
  BitmapData,
  BarcodeType,
  QRCorrection,
} from './types';

// ── CommandBuilder ────────────────────────────────────────────────────────────

export class CommandBuilder {
  private readonly _profile: PrinterProfile;
  private _buf: number[] = [];

  constructor(profile: PrinterProfile) {
    this._profile = profile;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Append individual bytes (inline literals: this.push(0x1b, 0x40))
  private push(...bytes: number[]): this {
    for (const b of bytes) this._buf.push(b & 0xff);
    return this;
  }

  // Append any iterable byte sequence: CMD.* arrays, Uint8Array from encode()
  private pushSeq(bytes: Iterable<number>): this {
    for (const b of bytes) this._buf.push(b & 0xff);
    return this;
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * ESC @ — Reset printer to power-on state.
   * Also sends ESC t to select the profile's default codepage.
   * Call this at the start of every job.
   */
  init(): this {
    this.pushSeq(CMD.INIT);
    this.codepage(this._profile.codepage);
    return this;
  }

  // ── Codepage ──────────────────────────────────────────────────────────────

  /**
   * ESC t n — Select character code table.
   * Switches the active codepage for subsequent text commands.
   */
  codepage(cp: Codepage): this {
    this.pushSeq(CMD.SET_CODEPAGE);
    this.push(codepageByte(cp));
    return this;
  }

  // ── Alignment ─────────────────────────────────────────────────────────────

  /**
   * ESC a n — Set text alignment.
   * Applies to all text until the next align() call.
   */
  align(a: Align): this {
    switch (a) {
      case 'left':   return this.pushSeq(CMD.ALIGN_LEFT);
      case 'center': return this.pushSeq(CMD.ALIGN_CENTER);
      case 'right':  return this.pushSeq(CMD.ALIGN_RIGHT);
    }
  }

  // ── Text style ────────────────────────────────────────────────────────────

  /**
   * ESC E n — Bold on/off.
   */
  bold(on: boolean): this {
    return this.pushSeq(on ? CMD.BOLD_ON : CMD.BOLD_OFF);
  }

  /**
   * ESC - n — Underline on/off (1-dot thick).
   */
  underline(on: boolean): this {
    return this.pushSeq(on ? CMD.UNDERLINE_ON : CMD.UNDERLINE_OFF);
  }

  /**
   * ESC M n — Select font A (normal) or font B (smaller, if supported).
   */
  font(f: 'A' | 'B'): this {
    return this.pushSeq(f === 'B' ? CMD.FONT_B : CMD.FONT_A);
  }

  // ── Text size ─────────────────────────────────────────────────────────────

  /**
   * GS ! n — Set character size.
   *
   * width  1 = normal, 2 = double-wide
   * height 1 = normal, 2 = double-high
   *
   * Not all printers support 2×2; many support only double-high or double-wide.
   */
  size(width: 1 | 2, height: 1 | 2): this {
    if (width === 1 && height === 1) return this.pushSeq(CMD.SIZE_NORMAL);
    if (width === 2 && height === 2) return this.pushSeq(CMD.SIZE_DOUBLE_WH);
    if (width === 2)                 return this.pushSeq(CMD.SIZE_DOUBLE_W);
    if (height === 2)                return this.pushSeq(CMD.SIZE_DOUBLE_H);
    return this;
  }

  /**
   * Resets all text styles: normal size, not bold, no underline, font A,
   * left-align.  Useful at the end of a styled section.
   */
  resetStyle(): this {
    return this
      .pushSeq(CMD.SIZE_NORMAL)
      .pushSeq(CMD.BOLD_OFF)
      .pushSeq(CMD.UNDERLINE_OFF)
      .pushSeq(CMD.FONT_A)
      .pushSeq(CMD.ALIGN_LEFT);
  }

  // ── Text content ──────────────────────────────────────────────────────────

  /**
   * Encodes `text` using the profile's codepage and appends the bytes.
   * Does NOT add a newline — append '\n' in the string or call newline().
   */
  text(s: string): this {
    return this.pushSeq(encode(s, this._profile.codepage));
  }

  /**
   * Appends a single LF byte (0x0A).
   */
  newline(): this {
    return this.push(LF);
  }

  // ── Paper feed ────────────────────────────────────────────────────────────

  /**
   * ESC d n — Feed n blank lines (1–255).
   * Cheaper printers may only support LF; falls back to repeating LF.
   */
  feed(lines = 1): this {
    const n = Math.max(1, Math.min(255, lines));
    // ESC d n is cleaner than repeating LFs
    this.pushSeq(CMD.FEED_N);
    this.push(n);
    return this;
  }

  // ── Cut ───────────────────────────────────────────────────────────────────

  /**
   * Appends the cut command determined by `mode` (defaults to profile setting).
   *
   * Also prepends the configured number of feed lines (feedBeforeCut) so the
   * last content line isn't eaten by the cutter mechanism.
   *
   * mode:
   *   'full'    — GS V 0 (clean cut through paper)
   *   'partial' — GS V 1 (leaves a thin join, paper tears cleanly)
   *   'feed'    — GS V A 0 (feed + full cut, Epson style)
   *   'none'    — no cut command appended
   */
  cut(mode?: CutMode): this {
    const m = mode ?? this._profile.cutMode;
    if (m === 'none') return this;

    // Feed before cut if profile requires it
    if (this._profile.feedBeforeCut > 0) {
      this.feed(this._profile.feedBeforeCut);
    }

    switch (m) {
      case 'full':    return this.pushSeq(CMD.CUT_FULL);
      case 'partial': return this.pushSeq(CMD.CUT_PARTIAL);
      case 'feed':    return this.pushSeq(CMD.CUT_FEED);
      default:        return this;
    }
  }

  // ── Cash drawer ───────────────────────────────────────────────────────────

  /**
   * ESC p — Send cash drawer kick pulse.
   * pin: '2pin' (default) or '5pin'
   */
  cashDrawer(pin: '2pin' | '5pin' = '2pin'): this {
    return this.pushSeq(
      pin === '5pin' ? CMD.CASH_DRAWER_5PIN : CMD.CASH_DRAWER_2PIN,
    );
  }

  // ── Raster image — GS v 0 ────────────────────────────────────────────────

  /**
   * GS v 0 — Print raster bit image (1bpp packed data).
   *
   * Silently skips if the profile marks raster as unsupported.
   *
   * @param bitmap  Pre-converted 1bpp bitmap (use formatter/image.ts to create)
   * @param mode    0=normal, 1=double-width, 2=double-height, 3=quadruple
   */
  image(bitmap: BitmapData, mode: 0 | 1 | 2 | 3 = 0): this {
    if (!this._profile.supportsRaster) return this;

    const bytesPerRow = Math.ceil(bitmap.width / 8);

    // GS v 0 <mode> <xL> <xH> <yL> <yH> <data>
    this.pushSeq(CMD.RASTER_IMAGE);
    this.push(mode);
    this.push(bytesPerRow & 0xff);          // xL
    this.push((bytesPerRow >> 8) & 0xff);   // xH
    this.push(bitmap.height & 0xff);        // yL
    this.push((bitmap.height >> 8) & 0xff); // yH
    this.pushSeq(bitmap.data);

    return this;
  }

  // ── QR Code — GS ( k ─────────────────────────────────────────────────────

  /**
   * Appends the full GS ( k QR code command sequence.
   *
   * Silently skips if the profile marks QR as unsupported.
   *
   * @param data        The string to encode (URL, text, etc.)
   * @param size        Module size 1–16 (default 3; larger = bigger QR)
   * @param correction  Error correction level (default 'M')
   */
  qr(data: string, opts: { size?: number; correction?: QRCorrection } = {}): this {
    if (!this._profile.supportsQR) return this;

    const { size = 3, correction = 'M' } = opts;
    const dataBytes = new TextEncoder().encode(data);
    const storeLen  = dataBytes.length + 3; // pL pH includes "31 50 30"
    const pL        = storeLen & 0xff;
    const pH        = (storeLen >> 8) & 0xff;

    // 1. Model 2
    this.pushSeq(CMD.QR_MODEL_2);

    // 2. Module size: GS ( k 3 0 49 67 <size>
    this.pushSeq(CMD.QR_SIZE_PREFIX);
    this.push(Math.max(1, Math.min(16, size)));

    // 3. Error correction: GS ( k 3 0 49 69 <level>
    this.pushSeq(CMD.QR_CORRECTION_PREFIX);
    this.push(QR_CORRECTION[correction]);

    // 4. Store data: GS ( k pL pH 49 80 48 <data>
    this.pushSeq(CMD.QR_STORE_PREFIX);
    this.push(pL, pH);
    this.push(0x31, 0x50, 0x30); // fn=80, m=48
    this.pushSeq(dataBytes);

    // 5. Print stored symbol
    this.pushSeq(CMD.QR_PRINT);

    return this;
  }

  // ── Barcode — GS k ───────────────────────────────────────────────────────

  /**
   * Appends a barcode command using the modern length-prefixed format.
   *
   * @param type    Barcode symbology
   * @param data    Barcode data string
   * @param height  Barcode height in dots (default 80)
   * @param hri     Human-readable text position: 'none'|'above'|'below'|'both'
   */
  barcode(
    type: BarcodeType,
    data: string,
    opts: { height?: number; hri?: 'none' | 'above' | 'below' | 'both' } = {},
  ): this {
    const { height = 80, hri = 'below' } = opts;
    const typeByte = BARCODE_TYPE_MODERN[type];
    if (typeByte === undefined) return this; // unsupported type

    const dataBytes = new TextEncoder().encode(data);

    // Set HRI position: GS H n
    this.pushSeq(CMD.BARCODE_HRI_POSITION);
    this.push({ none: 0, above: 1, below: 2, both: 3 }[hri]);

    // Set height: GS h n
    this.pushSeq(CMD.BARCODE_HEIGHT);
    this.push(Math.max(1, Math.min(255, height)));

    // Print barcode (modern length-prefixed): GS k <type> <len> <data>
    this.pushSeq(CMD.BARCODE_MODERN);
    this.push(typeByte);
    this.push(dataBytes.length);
    this.pushSeq(dataBytes);

    return this;
  }

  // ── Raw escape hatch ──────────────────────────────────────────────────────

  /**
   * Appends arbitrary bytes directly to the buffer.
   * Use for printer-specific commands not covered by the standard API.
   *
   * @example
   *   builder.raw([0x1B, 0x40]) // manual ESC @
   */
  raw(bytes: number[]): this {
    return this.pushSeq(bytes);
  }

  // ── Output ────────────────────────────────────────────────────────────────

  /**
   * Returns the accumulated bytes as a Uint8Array.
   * The builder is NOT reset — call again to get the same bytes.
   * Clone the result if you need to mutate it.
   */
  build(): Uint8Array {
    return new Uint8Array(this._buf);
  }

  /**
   * Returns the accumulated bytes as a space-separated hex string.
   * Invaluable for debugging unexpected printer behaviour.
   *
   * @example
   *   builder.init().text('Hi\n').cut().debugHex()
   *   // → "1B 40 1B 74 00 48 69 0A 0A 0A 0A 1D 56 01"
   */
  debugHex(): string {
    return this._buf
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ');
  }

  /**
   * Resets the internal buffer so the builder can be reused.
   * Returns `this` for chaining: builder.reset().init()...
   */
  reset(): this {
    this._buf = [];
    return this;
  }

  /**
   * Returns a snapshot of the current byte count — useful for asserting
   * that a section actually added bytes.
   */
  get byteLength(): number {
    return this._buf.length;
  }
}
