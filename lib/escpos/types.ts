/**
 * lib/escpos/types.ts
 *
 * Shared types for the ESC/POS library.
 * No logic — only interfaces, enums, and type aliases.
 */

// ── Codepage ──────────────────────────────────────────────────────────────────

export type Codepage = 'cp437' | 'cp858' | 'gbk' | 'utf8';

// ── Text alignment ────────────────────────────────────────────────────────────

export type Align = 'left' | 'center' | 'right';

// ── Text size ─────────────────────────────────────────────────────────────────

export interface TextSize {
  width: 1 | 2;
  height: 1 | 2;
}

// ── Cut mode ──────────────────────────────────────────────────────────────────

export type CutMode = 'full' | 'partial' | 'feed' | 'none';

// ── Barcode type ──────────────────────────────────────────────────────────────

export type BarcodeType =
  | 'UPC_A'
  | 'UPC_E'
  | 'EAN13'
  | 'EAN8'
  | 'CODE39'
  | 'ITF'
  | 'CODABAR'
  | 'CODE93'
  | 'CODE128';

// ── QR error correction ───────────────────────────────────────────────────────

export type QRCorrection = 'L' | 'M' | 'Q' | 'H';

// ── Bitmap data (1bpp, packed, row-major, MSB-left) ───────────────────────────

export interface BitmapData {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels (number of rows) */
  height: number;
  /**
   * Packed 1-bit-per-pixel data.
   * Row-major order. Within each byte, the MSB is the leftmost pixel.
   * Length must equal Math.ceil(width / 8) * height.
   */
  data: Uint8Array;
}

// ── Printer profile ───────────────────────────────────────────────────────────

export interface PrinterProfile {
  /** Human-readable identifier, e.g. 'generic', 'epson', 'rongta' */
  name: string;

  /**
   * Characters per line.
   * Typical values: 32 (58 mm paper), 42–48 (80 mm paper).
   */
  charWidth: number;

  /** Default codepage sent to the printer on init */
  codepage: Codepage;

  /** Which cut command to use at the end of a job */
  cutMode: CutMode;

  /**
   * Number of blank lines to feed before the cut command.
   * Some printers need 3–5 feeds or the last line is eaten by the cutter.
   */
  feedBeforeCut: number;

  /** Whether this printer supports GS v 0 raster image printing */
  supportsRaster: boolean;

  /** Whether this printer supports GS ( k QR code commands */
  supportsQR: boolean;
}

// ── Column definition (used by formatter/columns.ts) ─────────────────────────

export interface ColumnDef {
  text: string;
  /**
   * Fraction of the total line width this column occupies (0.0–1.0).
   * All column widths in a row must sum to ≤ 1.0.
   */
  width: number;
  align?: Align;
  /** What to do when text exceeds the column width. Default: 'truncate' */
  overflow?: 'truncate' | 'wrap';
}
