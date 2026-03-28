/**
 * lib/escpos/commands.ts
 *
 * Raw ESC/POS byte constants.
 * Pure data — no logic, no functions.
 *
 * References:
 *   https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/
 */

// ── Control bytes ─────────────────────────────────────────────────────────────

export const ESC = 0x1b;
export const GS  = 0x1d;
export const FS  = 0x1c;
export const DLE = 0x10;
export const LF  = 0x0a;
export const CR  = 0x0d;
export const HT  = 0x09;
export const NUL = 0x00;
export const SP  = 0x20;

// ── ESC/POS command byte sequences ───────────────────────────────────────────
//
// Each entry is a readonly number[] — append to a growing byte array.
// Commands that require parameters append only the fixed prefix here;
// callers add the variable byte(s) after.

export const CMD = {
  // ── Initialisation ────────────────────────────────────────────────────────
  /** ESC @ — Initialize printer (clears buffers, resets modes) */
  INIT: [ESC, 0x40],

  // ── Alignment — ESC a n ───────────────────────────────────────────────────
  /** ESC a 0 — Left align */
  ALIGN_LEFT:   [ESC, 0x61, 0x00],
  /** ESC a 1 — Center align */
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  /** ESC a 2 — Right align */
  ALIGN_RIGHT:  [ESC, 0x61, 0x02],

  // ── Text style ────────────────────────────────────────────────────────────
  /** ESC E 1 — Bold on */
  BOLD_ON:         [ESC, 0x45, 0x01],
  /** ESC E 0 — Bold off */
  BOLD_OFF:        [ESC, 0x45, 0x00],
  /** ESC - 1 — Underline on (1-dot) */
  UNDERLINE_ON:    [ESC, 0x2d, 0x01],
  /** ESC - 0 — Underline off */
  UNDERLINE_OFF:   [ESC, 0x2d, 0x00],
  /** ESC M 0 — Font A (normal) */
  FONT_A:          [ESC, 0x4d, 0x00],
  /** ESC M 1 — Font B (smaller) */
  FONT_B:          [ESC, 0x4d, 0x01],

  // ── Text size — GS ! n ────────────────────────────────────────────────────
  /** GS ! 0 — Normal size (1×1) */
  SIZE_NORMAL:      [GS, 0x21, 0x00],
  /** GS ! 0x10 — Double height (1×2) */
  SIZE_DOUBLE_H:    [GS, 0x21, 0x10],
  /** GS ! 0x20 — Double width (2×1) */
  SIZE_DOUBLE_W:    [GS, 0x21, 0x20],
  /** GS ! 0x30 — Double width + height (2×2) */
  SIZE_DOUBLE_WH:   [GS, 0x21, 0x30],

  // ── Line feed / paper feed ────────────────────────────────────────────────
  /** LF — Line feed (advance one line) */
  LF: [LF],
  /**
   * ESC d n — Feed n lines.
   * Append the line count byte after this prefix.
   * e.g.  [...CMD.FEED_N, 3]  feeds 3 lines
   */
  FEED_N: [ESC, 0x64],

  // ── Cut ───────────────────────────────────────────────────────────────────
  /** GS V 0 — Full cut */
  CUT_FULL:    [GS, 0x56, 0x00],
  /** GS V 1 — Partial cut */
  CUT_PARTIAL: [GS, 0x56, 0x01],
  /** GS V A 0 — Feed + full cut (Epson CUT_FEED style) */
  CUT_FEED:    [GS, 0x56, 0x41, 0x00],

  // ── Cash drawer — ESC p ───────────────────────────────────────────────────
  /** ESC p 0 25 250 — Pin 2, 25ms on, 250ms off */
  CASH_DRAWER_2PIN: [ESC, 0x70, 0x00, 0x19, 0xfa],
  /** ESC p 1 25 250 — Pin 5, 25ms on, 250ms off */
  CASH_DRAWER_5PIN: [ESC, 0x70, 0x01, 0x19, 0xfa],

  // ── Codepage — ESC t n ────────────────────────────────────────────────────
  /**
   * ESC t n — Select character code table.
   * Append the codepage byte (see CODEPAGE_BYTE map in encoder.ts).
   */
  SET_CODEPAGE: [ESC, 0x74],

  // ── Raster image — GS v 0 ────────────────────────────────────────────────
  /**
   * GS v 0 m — Print raster bit image.
   * Append: m (mode 0=normal), xL xH (bytes per row), yL yH (rows), <data>
   * m=0 normal, m=1 double-width, m=2 double-height, m=3 quadruple
   */
  RASTER_IMAGE: [GS, 0x76, 0x30],

  // ── QR Code — GS ( k ─────────────────────────────────────────────────────
  // These are the fixed prefixes; callers append the required parameter bytes.
  // See builder.ts qr() for the full sequence.

  /** GS ( k — Model select: Model 2 (fixed sequence, no variable params) */
  QR_MODEL_2: [GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00],
  /**
   * GS ( k 3 0 49 67 — Module size prefix.
   * Append 1 byte: size (1–16, typically 3–6)
   */
  QR_SIZE_PREFIX: [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43],
  /**
   * GS ( k 3 0 49 69 — Error correction prefix.
   * Append 1 byte: 0x30=L 0x31=M 0x32=Q 0x33=H
   */
  QR_CORRECTION_PREFIX: [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45],
  /**
   * GS ( k pL pH 49 80 48 — Store QR data prefix.
   * Append pL, pH (length = data.length + 3), then data bytes.
   */
  QR_STORE_PREFIX: [GS, 0x28, 0x6b],
  /** GS ( k 3 0 49 81 48 — Print stored QR symbol (fixed, no params) */
  QR_PRINT: [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30],

  // ── Barcode — GS k ───────────────────────────────────────────────────────
  /**
   * GS k m — Print barcode (legacy NUL-terminated format).
   * Append: type byte, data bytes, 0x00
   */
  BARCODE_LEGACY: [GS, 0x6b],
  /**
   * GS k m n — Print barcode (modern length-prefixed format).
   * type byte ≥ 65 (0x41).  Append: type+65, length, data bytes.
   */
  BARCODE_MODERN: [GS, 0x6b],

  /**
   * GS H n — Barcode HRI (human-readable text) position.
   * Append: 0=none 1=above 2=below 3=both
   */
  BARCODE_HRI_POSITION: [GS, 0x48],
  /**
   * GS h n — Barcode height in dots (1–255).
   * Append height byte. Default 162.
   */
  BARCODE_HEIGHT: [GS, 0x68],
  /**
   * GS w n — Barcode module width (2–6 dots).
   * Append width byte.
   */
  BARCODE_WIDTH: [GS, 0x77],
} as const;

// ── Barcode type bytes ────────────────────────────────────────────────────────

/** Legacy GS k type values (0-based, NUL-terminated format) */
export const BARCODE_TYPE_LEGACY = {
  UPC_A:   0x00,
  UPC_E:   0x01,
  EAN13:   0x02,
  EAN8:    0x03,
  CODE39:  0x04,
  ITF:     0x05,
  CODABAR: 0x06,
} as const;

/** Modern GS k type values (subtract 65 for legacy equivalent) */
export const BARCODE_TYPE_MODERN = {
  UPC_A:    0x41,
  UPC_E:    0x42,
  EAN13:    0x43,
  EAN8:     0x44,
  CODE39:   0x45,
  ITF:      0x46,
  CODABAR:  0x47,
  CODE93:   0x48,
  CODE128:  0x49,
} as const;

// ── Correction level bytes (QR) ───────────────────────────────────────────────

export const QR_CORRECTION = {
  L: 0x30,
  M: 0x31,
  Q: 0x32,
  H: 0x33,
} as const;
