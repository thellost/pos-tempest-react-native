/**
 * lib/escpos/receipt/dsl.ts
 *
 * Layer 2 — receipt() compiler.
 *
 * Converts an array of ReceiptElements into a complete ESC/POS Uint8Array
 * ready to be handed to a transport.
 *
 * Usage:
 *   import { receipt, text, row, divider, total } from '@/lib/escpos'
 *   import { GENERIC_PROFILE_80 } from '@/lib/escpos'
 *
 *   const bytes = receipt([
 *     header(),
 *     text('MY STORE', { align: 'center', bold: true, size: { width: 1, height: 2 } }),
 *     header(),
 *     row('Subtotal', 'Rp50.000'),
 *     total('TOTAL', 'Rp50.000'),
 *   ], { profile: GENERIC_PROFILE_80 })
 *
 *   // bytes is a Uint8Array — pass to BluetoothTransport.send(bytes)
 */

import { CommandBuilder } from '../builder';
import { formatRow } from '../formatter/columns';
import { formatColumns } from '../formatter/columns';
import type { PrinterProfile, Codepage } from '../types';
import type {
  ReceiptElement,
  TextEl,
  RowEl,
  ColumnsEl,
  DividerEl,
  HeaderEl,
  SpaceEl,
  TotalEl,
  QREl,
  BarcodeEl,
  ImageEl,
  RawEl,
} from './elements';

// ── Public API ────────────────────────────────────────────────────────────────

export interface ReceiptOptions {
  profile: PrinterProfile;
  /**
   * Override the profile's codepage for this receipt.
   * Useful when the receipt contains characters outside CP437
   * but you don't want to change the profile globally.
   */
  codepage?: Codepage;
  /**
   * When true, skips the automatic ESC @ init at the start.
   * Useful if you're appending to an already-initialised job.
   * Default: false
   */
  skipInit?: boolean;
  /**
   * When true, skips the automatic cut command at the end.
   * Useful for multi-section jobs where you add the cut manually.
   * Default: false
   */
  skipCut?: boolean;
}

/**
 * Compiles a list of receipt elements into a complete ESC/POS Uint8Array.
 *
 * The output always begins with ESC @ (init) and ends with the cut sequence
 * defined in the profile, unless skipInit / skipCut are set.
 */
export function receipt(
  elements: ReceiptElement[],
  options: ReceiptOptions,
): Uint8Array {
  const { profile, codepage, skipInit = false, skipCut = false } = options;

  // Build an effective profile: if a codepage override is provided, apply it
  const effectiveProfile: PrinterProfile = codepage
    ? { ...profile, codepage }
    : profile;

  const builder = new CommandBuilder(effectiveProfile);

  if (!skipInit) {
    builder.init();
  }

  for (const el of elements) {
    renderElement(builder, el, effectiveProfile.charWidth);
  }

  if (!skipCut) {
    builder.cut();
  }

  return builder.build();
}

// ── Element renderers ─────────────────────────────────────────────────────────

function renderElement(
  b: CommandBuilder,
  el: ReceiptElement,
  lineWidth: number,
): void {
  switch (el.kind) {
    case 'text':    return renderText(b, el);
    case 'row':     return renderRow(b, el, lineWidth);
    case 'columns': return renderColumns(b, el, lineWidth);
    case 'divider': return renderDivider(b, el, lineWidth);
    case 'header':  return renderHeader(b, el, lineWidth);
    case 'space':   return renderSpace(b, el);
    case 'total':   return renderTotal(b, el, lineWidth);
    case 'qr':      return renderQR(b, el);
    case 'barcode': return renderBarcode(b, el);
    case 'image':   return renderImage(b, el);
    case 'raw':     return renderRaw(b, el);
    default: {
      // TypeScript exhaustiveness check — will error if a new kind is added
      // to ReceiptElement without a corresponding case above.
      const _exhaustive: never = el;
      void _exhaustive;
    }
  }
}

// ── text ──────────────────────────────────────────────────────────────────────

function renderText(b: CommandBuilder, el: TextEl): void {
  const { content, align = 'left', bold = false, underline = false, size } = el;

  b.align(align);
  if (bold)      b.bold(true);
  if (underline) b.underline(true);
  if (size)      b.size(size.width, size.height);

  b.text(content);
  b.newline();

  // Always reset after styled text so the next element starts clean
  b.resetStyle();
}

// ── row ───────────────────────────────────────────────────────────────────────

function renderRow(b: CommandBuilder, el: RowEl, lineWidth: number): void {
  const line = formatRow(el.label, el.value, lineWidth);

  if (el.bold) b.bold(true);
  b.text(line);
  b.newline();
  if (el.bold) b.bold(false);
}

// ── columns ───────────────────────────────────────────────────────────────────

function renderColumns(
  b: CommandBuilder,
  el: ColumnsEl,
  lineWidth: number,
): void {
  const lines = formatColumns(el.cols, lineWidth);

  if (el.bold) b.bold(true);
  for (const line of lines) {
    b.text(line);
    b.newline();
  }
  if (el.bold) b.bold(false);
}

// ── divider ───────────────────────────────────────────────────────────────────

function renderDivider(
  b: CommandBuilder,
  el: DividerEl,
  lineWidth: number,
): void {
  const char = el.char ?? '\u2500'; // '─' BOX DRAWINGS LIGHT HORIZONTAL
  b.text(repeatFill(char, lineWidth));
  b.newline();
}

// ── header ────────────────────────────────────────────────────────────────────

function renderHeader(
  b: CommandBuilder,
  el: HeaderEl,
  lineWidth: number,
): void {
  const char = el.char ?? '\u2550'; // '═' BOX DRAWINGS DOUBLE HORIZONTAL
  b.text(repeatFill(char, lineWidth));
  b.newline();
}

// ── space ─────────────────────────────────────────────────────────────────────

function renderSpace(b: CommandBuilder, el: SpaceEl): void {
  b.feed(el.lines ?? 1);
}

// ── total ─────────────────────────────────────────────────────────────────────

function renderTotal(b: CommandBuilder, el: TotalEl, lineWidth: number): void {
  // Double-height text: lineWidth stays the same in character count,
  // but each line is printed twice as tall — making the total stand out.
  b.bold(true);
  b.size(1, 2);

  const line = formatRow(el.label, el.value, lineWidth);
  b.text(line);
  b.newline();

  b.resetStyle();
}

// ── qr ───────────────────────────────────────────────────────────────────────

function renderQR(b: CommandBuilder, el: QREl): void {
  withCenter(b, () => b.qr(el.data, { size: el.size, correction: el.correction }));
}

// ── barcode ───────────────────────────────────────────────────────────────────

function renderBarcode(b: CommandBuilder, el: BarcodeEl): void {
  withCenter(b, () => b.barcode(el.type, el.data, { height: el.height, hri: el.hri }));
}

// ── image ─────────────────────────────────────────────────────────────────────

function renderImage(b: CommandBuilder, el: ImageEl): void {
  withCenter(b, () => b.image(el.bitmap, el.mode));
}

function withCenter(b: CommandBuilder, render: () => void): void {
  b.align('center');
  render();
  b.newline();
  b.align('left');
}

// ── raw ───────────────────────────────────────────────────────────────────────

function renderRaw(b: CommandBuilder, el: RawEl): void {
  b.raw(el.bytes);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fills `width` columns with `char`, repeating it as many times as needed.
 * Handles multi-character fill patterns (e.g. '- ') by truncating to width.
 */
function repeatFill(char: string, width: number): string {
  if (char.length === 0) return ' '.repeat(width);
  // Repeat enough times then slice to exact width
  const repeated = char.repeat(Math.ceil(width / char.length));
  return repeated.slice(0, width);
}
