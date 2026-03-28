/**
 * lib/escpos/receipt/elements.ts
 *
 * Layer 2 — Receipt DSL element types and factory functions.
 *
 * Each element is a plain object with a `kind` discriminant.
 * Factory functions give you autocomplete and safe defaults.
 *
 * Usage:
 *   import { text, row, divider, total, qr } from '@/lib/escpos'
 *
 *   const elements = [
 *     header(),
 *     text('MY STORE', { align: 'center', bold: true, size: { width: 1, height: 2 } }),
 *     header(),
 *     text('Order : #0042'),
 *     divider(),
 *     columns([
 *       { text: '2x Nasi Goreng', width: 0.65 },
 *       { text: 'Rp50.000',       width: 0.35, align: 'right' },
 *     ]),
 *     divider(),
 *     row('Subtotal', 'Rp50.000'),
 *     total('TOTAL', 'Rp50.000'),
 *     space(2),
 *     qr('https://mystore.com/receipt/42'),
 *   ]
 */

import type {
  Align,
  TextSize,
  BitmapData,
  BarcodeType,
  QRCorrection,
  ColumnDef,
} from '../types';

// ── Element types ─────────────────────────────────────────────────────────────

/** A line of styled text. Automatically resets style after rendering. */
export interface TextEl {
  kind: 'text';
  content: string;
  align?: Align;
  bold?: boolean;
  underline?: boolean;
  size?: TextSize;
}

/**
 * A two-column left-label / right-value row.
 * The label is left-aligned, value is right-aligned.
 * Both are formatted to fill exactly `lineWidth` chars.
 *
 * e.g.  row('Subtotal', 'Rp10.000') →  "Subtotal          Rp10.000"
 */
export interface RowEl {
  kind: 'row';
  label: string;
  value: string;
  bold?: boolean;
}

/**
 * N-column row using fractional widths.
 * Widths must sum to ≤ 1.0.
 *
 * e.g.  columns([
 *          { text: '2x Nasi Goreng', width: 0.65 },
 *          { text: 'Rp50.000', width: 0.35, align: 'right' },
 *       ])
 */
export interface ColumnsEl {
  kind: 'columns';
  cols: ColumnDef[];
  bold?: boolean;
}

/**
 * A full-width horizontal divider line.
 * Default char: '─'  (U+2500 BOX DRAWINGS LIGHT HORIZONTAL — CP437 0xC4)
 */
export interface DividerEl {
  kind: 'divider';
  char?: string;
}

/**
 * A full-width heavy horizontal divider (used for major section boundaries).
 * Default char: '═'  (U+2550 BOX DRAWINGS DOUBLE HORIZONTAL — CP437 0xCD)
 */
export interface HeaderEl {
  kind: 'header';
  char?: string;
}

/** One or more blank lines (paper feed). Default: 1 line. */
export interface SpaceEl {
  kind: 'space';
  lines?: number;
}

/**
 * Grand total row — rendered bold and double-height to stand out.
 * label is left-aligned, value is right-aligned, filling lineWidth chars.
 *
 * e.g.  total('TOTAL', 'Rp150.000')
 */
export interface TotalEl {
  kind: 'total';
  label: string;
  value: string;
}

/** QR code. Data is always encoded as UTF-8 bytes in the GS ( k sequence. */
export interface QREl {
  kind: 'qr';
  data: string;
  /** Module size 1–16. Default 3. Larger = bigger printed QR. */
  size?: number;
  correction?: QRCorrection;
}

/** Barcode. */
export interface BarcodeEl {
  kind: 'barcode';
  type: BarcodeType;
  data: string;
  /** Barcode height in dots. Default 80. */
  height?: number;
  hri?: 'none' | 'above' | 'below' | 'both';
}

/**
 * Raster image (1bpp packed BitmapData).
 * Use formatter/image.ts uriToBitmap() to prepare the bitmap.
 */
export interface ImageEl {
  kind: 'image';
  bitmap: BitmapData;
  /** GS v 0 mode: 0=normal, 1=double-width, 2=double-height, 3=quadruple */
  mode?: 0 | 1 | 2 | 3;
}

/** Raw byte escape hatch — appended verbatim. */
export interface RawEl {
  kind: 'raw';
  bytes: number[];
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type ReceiptElement =
  | TextEl
  | RowEl
  | ColumnsEl
  | DividerEl
  | HeaderEl
  | SpaceEl
  | TotalEl
  | QREl
  | BarcodeEl
  | ImageEl
  | RawEl;

// ── Factory functions ─────────────────────────────────────────────────────────

/**
 * A styled text line.
 *
 * @example
 *   text('MY STORE', { align: 'center', bold: true, size: { width: 1, height: 2 } })
 *   text('Order : #0042')
 */
export function text(
  content: string,
  opts: Omit<TextEl, 'kind' | 'content'> = {},
): TextEl {
  return { kind: 'text', content, ...opts };
}

/**
 * A left/right two-column row.
 *
 * @example
 *   row('Subtotal', 'Rp50.000')
 *   row('Diskon',  '-Rp5.000', { bold: true })
 */
export function row(
  label: string,
  value: string,
  opts: Omit<RowEl, 'kind' | 'label' | 'value'> = {},
): RowEl {
  return { kind: 'row', label, value, ...opts };
}

/**
 * An N-column row with fractional widths.
 *
 * @example
 *   columns([
 *     { text: '2x Nasi Goreng', width: 0.65 },
 *     { text: 'Rp50.000',       width: 0.35, align: 'right' },
 *   ])
 */
export function columns(
  cols: ColumnDef[],
  opts: Omit<ColumnsEl, 'kind' | 'cols'> = {},
): ColumnsEl {
  return { kind: 'columns', cols, ...opts };
}

/**
 * A light horizontal rule.  Default char: '─'
 *
 * @example
 *   divider()       // ────────────────────────────────
 *   divider('- ')   // - - - - - - - - - - - - - - - -
 */
export function divider(char?: string): DividerEl {
  return { kind: 'divider', char };
}

/**
 * A heavy horizontal rule for major section boundaries.  Default char: '═'
 *
 * @example
 *   header()   // ════════════════════════════════
 */
export function header(char?: string): HeaderEl {
  return { kind: 'header', char };
}

/**
 * One or more blank lines.  Default: 1
 *
 * @example
 *   space()    // 1 blank line
 *   space(3)   // 3 blank lines
 */
export function space(lines?: number): SpaceEl {
  return { kind: 'space', lines };
}

/**
 * Grand total row — bold + double-height.
 *
 * @example
 *   total('TOTAL', 'Rp150.000')
 */
export function total(label: string, value: string): TotalEl {
  return { kind: 'total', label, value };
}

/**
 * QR code.
 *
 * @example
 *   qr('https://example.com/receipt/42')
 *   qr('https://example.com', { size: 5, correction: 'H' })
 */
export function qr(
  data: string,
  opts: Omit<QREl, 'kind' | 'data'> = {},
): QREl {
  return { kind: 'qr', data, ...opts };
}

/**
 * Barcode.
 *
 * @example
 *   barcode('CODE128', '0123456789')
 *   barcode('EAN13', '4006381333931', { height: 60, hri: 'below' })
 */
export function barcode(
  type: BarcodeType,
  data: string,
  opts: Omit<BarcodeEl, 'kind' | 'type' | 'data'> = {},
): BarcodeEl {
  return { kind: 'barcode', type, data, ...opts };
}

/**
 * Raster image.  Prepare the bitmap with uriToBitmap() from formatter/image.ts.
 *
 * @example
 *   const bmp = await uriToBitmap(logoUri, profile.charWidth * 12)
 *   image(bmp)
 */
export function image(bitmap: BitmapData, mode?: 0 | 1 | 2 | 3): ImageEl {
  return { kind: 'image', bitmap, mode };
}

/**
 * Raw bytes — appended verbatim.  Escape hatch for non-standard commands.
 *
 * @example
 *   raw([0x1B, 0x40])   // manual ESC @
 */
export function raw(bytes: number[]): RawEl {
  return { kind: 'raw', bytes };
}
