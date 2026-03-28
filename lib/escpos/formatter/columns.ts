/**
 * lib/escpos/formatter/columns.ts
 *
 * Fixed-width column layout for ESC/POS receipt printing.
 *
 * The fundamental problem: thermal printers are monospace.  You can't rely on
 * CSS flexbox or proportional fonts.  Every row is a string of exactly
 * `lineWidth` characters — you build it yourself.
 *
 * Usage:
 *   formatRow('Subtotal', 'Rp10.000', 48)
 *   // → 'Subtotal                           Rp10.000'
 *
 *   formatColumns([
 *     { text: '1x Nasi Goreng', width: 0.6 },
 *     { text: 'Rp25.000',       width: 0.4, align: 'right' },
 *   ], 48)
 *   // → ['1x Nasi Goreng            Rp25.000']
 */

import type { Align, ColumnDef } from '../types';
import { wrapText, padEnd, padStart, padCenter, truncate } from './wrap';

// ── formatRow ─────────────────────────────────────────────────────────────────

/**
 * Formats a two-column left-label / right-value row into a string of exactly
 * `lineWidth` characters.
 *
 * If label + value together exceed lineWidth, the label is truncated.
 *
 * @example
 *   formatRow('Total', 'Rp150.000', 32)
 *   // → 'Total              Rp150.000'
 */
export function formatRow(
  label: string,
  value: string,
  lineWidth: number,
): string {
  const gap = lineWidth - label.length - value.length;

  if (gap >= 1) {
    // Normal case: enough space — pad with spaces between label and value
    return label + ' '.repeat(gap) + value;
  }

  // Label + value exceeds line width — truncate label to fit
  const maxLabelWidth = lineWidth - value.length - 1; // at least 1 space
  if (maxLabelWidth <= 0) {
    // Extreme case: even the value alone fills the line — truncate value
    return value.slice(0, lineWidth);
  }
  return truncate(label, maxLabelWidth) + ' ' + value;
}

// ── formatColumns ─────────────────────────────────────────────────────────────

/**
 * Formats a list of column definitions into one or more lines of exactly
 * `lineWidth` characters each.
 *
 * Column widths are fractional (0.0–1.0) and are resolved to character counts
 * by multiplying against `lineWidth`.  Any remainder goes to the last column.
 *
 * When a column overflows (`overflow: 'wrap'`), the row expands into multiple
 * lines with empty cells in the non-wrapping columns.
 *
 * @returns Array of lines.  Typically one line; more if any column wraps.
 *
 * @example
 *   formatColumns([
 *     { text: 'Item Name',  width: 0.65 },
 *     { text: 'Rp25.000',   width: 0.35, align: 'right' },
 *   ], 32)
 *   // → ['Item Name           Rp25.000']
 */
export function formatColumns(
  cols: ColumnDef[],
  lineWidth: number,
): string[] {
  if (cols.length === 0) return [''];

  // ── Step 1: resolve fractional widths to integer character counts ─────────
  const charWidths = resolveWidths(cols, lineWidth);

  // ── Step 2: render each column into its lines (may wrap) ──────────────────
  const cellLines: string[][] = cols.map((col, i) => {
    const w = charWidths[i];
    return renderCell(col.text, w, col.align ?? 'left', col.overflow ?? 'truncate');
  });

  // ── Step 3: normalise to same number of lines (pad short columns) ─────────
  const numLines = Math.max(...cellLines.map((c) => c.length));
  const padded = cellLines.map((lines, i) => {
    const w = charWidths[i];
    while (lines.length < numLines) lines.push(' '.repeat(w));
    return lines;
  });

  // ── Step 4: join columns per line ─────────────────────────────────────────
  return Array.from({ length: numLines }, (_, li) =>
    padded.map((lines) => lines[li]).join(''),
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Converts fractional widths to integer character counts.
 * The last column absorbs any rounding remainder so the row sums to lineWidth.
 */
function resolveWidths(cols: ColumnDef[], lineWidth: number): number[] {
  const widths = cols.map((c) => Math.floor(c.width * lineWidth));
  const used   = widths.reduce((a, b) => a + b, 0);
  const remainder = lineWidth - used;
  // Give remainder to the last column (or spread — keeping it simple)
  if (widths.length > 0) widths[widths.length - 1] += remainder;
  return widths;
}

/**
 * Renders a single cell into an array of fixed-width lines.
 * Each line is exactly `width` characters.
 */
function renderCell(
  text: string,
  width: number,
  align: Align,
  overflow: 'truncate' | 'wrap',
): string[] {
  if (width <= 0) return [];

  if (overflow === 'wrap') {
    const wrapped = wrapText(text, width);
    return wrapped.map((line) => applyAlign(line, width, align));
  }

  // truncate
  const single = truncate(text, width);
  return [applyAlign(single, width, align)];
}

function applyAlign(text: string, width: number, align: Align): string {
  switch (align) {
    case 'right':  return padStart(text, width);
    case 'center': return padCenter(text, width);
    default:       return padEnd(text, width);
  }
}
