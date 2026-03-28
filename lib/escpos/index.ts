/**
 * lib/escpos/index.ts
 *
 * Public API barrel for the ESC/POS library.
 *
 * Consumers import from '@/lib/escpos' only — never from internal sub-paths.
 *
 * @example
 *   import {
 *     receipt, text, row, divider, header, space, total, qr,
 *     GENERIC_PROFILE_80,
 *     CommandBuilder,
 *   } from '@/lib/escpos'
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  PrinterProfile,
  Codepage,
  Align,
  TextSize,
  CutMode,
  BarcodeType,
  QRCorrection,
  BitmapData,
  ColumnDef,
} from './types';

export type {
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
} from './receipt/elements';

export type { ReceiptOptions } from './receipt/dsl';

// ── Layer 1 — CommandBuilder ──────────────────────────────────────────────────

export { CommandBuilder } from './builder';

// ── Layer 1 — Encoder ─────────────────────────────────────────────────────────

export { encode, codepageByte } from './encoder';

// ── Layer 1 — Formatters ──────────────────────────────────────────────────────

export { wrapText, truncate, padEnd, padStart, padCenter } from './formatter/wrap';
export { formatRow, formatColumns } from './formatter/columns';

// ── Layer 2 — Receipt DSL ─────────────────────────────────────────────────────

export { receipt } from './receipt/dsl';

export {
  text,
  row,
  columns,
  divider,
  header,
  space,
  total,
  qr,
  barcode,
  image,
  raw,
} from './receipt/elements';

// ── Layer 3 — Transport ───────────────────────────────────────────────────────

export type { PrintTransport, TransportOptions } from './transport/types';
export { BluetoothTransport, sendInChunks, normalizeMac } from './transport/bluetooth';

// ── Printer Profiles ──────────────────────────────────────────────────────────

export { GENERIC_PROFILE_58, GENERIC_PROFILE_80 } from './profiles/generic';
export { EPSON_PROFILE_80, EPSON_PROFILE_80_WIDE } from './profiles/epson';
export { RONGTA_PROFILE_58, RONGTA_PROFILE_80 } from './profiles/rongta';
