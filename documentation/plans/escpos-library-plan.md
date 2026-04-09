# ESC/POS Library Plan

## Goal

Replace the current ad-hoc string-based printing (`formatKOT`, `formatBill`, raw
`Buffer.from(text, 'utf8')`) with a layered, brand-agnostic ESC/POS byte-generation
library.  The library lives in `lib/escpos/` and is consumed by the existing
`lib/printer.ts` and `lib/bluetooth.ts`.

---

## Architecture: 3 Strict Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 2 — Receipt DSL  (lib/escpos/receipt/)       │
│  receipt([text(), row(), divider(), total()])        │
│  → delegates to CommandBuilder                      │
├─────────────────────────────────────────────────────┤
│  Layer 1 — CommandBuilder  (lib/escpos/builder.ts)  │
│  Pure: no I/O, no React Native.  Outputs Uint8Array │
│  builder.text() .bold() .align() .qr() .cut()       │
├─────────────────────────────────────────────────────┤
│  Layer 3 — Transport  (lib/escpos/transport/)       │
│  Bluetooth Classic via react-native-bluetooth-classic│
│  sendInChunks(buffer, chunkSize, delayMs)            │
└─────────────────────────────────────────────────────┘
```

The layers have a strict one-way dependency:
- DSL → CommandBuilder → raw bytes
- Transport knows nothing about receipt content
- CommandBuilder knows nothing about React Native

---

## File Structure

```
lib/escpos/
├── index.ts                 ← public API barrel (re-exports everything callers need)
├── types.ts                 ← shared enums & interfaces
├── commands.ts              ← ESC/POS byte constants (no logic, pure data)
├── builder.ts               ← Layer 1: CommandBuilder class
├── encoder.ts               ← text → Uint8Array with codepage mapping
├── formatter/
│   ├── columns.ts           ← formatColumns(), formatRow()
│   └── wrap.ts              ← wrapText(), truncate()
├── receipt/
│   ├── elements.ts          ← DSL element type definitions + factory functions
│   └── dsl.ts               ← Layer 2: receipt() — compiles elements → Uint8Array
├── transport/
│   ├── types.ts             ← PrintTransport interface
│   └── bluetooth.ts         ← BluetoothTransport (react-native-bluetooth-classic)
└── profiles/
    ├── generic.ts           ← default PrinterProfile (safe, widely compatible)
    ├── epson.ts             ← Epson overrides
    └── rongta.ts            ← Rongta / Xprinter overrides
```

---

## Layer 1 — `commands.ts`

Pure byte-constant map — no functions, just data.

```ts
export const ESC = 0x1B;
export const GS  = 0x1D;
export const LF  = 0x0A;
export const NUL = 0x00;

export const CMD = {
  INIT:            [ESC, 0x40],           // ESC @  — reset
  ALIGN_LEFT:      [ESC, 0x61, 0x00],     // ESC a 0
  ALIGN_CENTER:    [ESC, 0x61, 0x01],     // ESC a 1
  ALIGN_RIGHT:     [ESC, 0x61, 0x02],     // ESC a 2
  BOLD_ON:         [ESC, 0x45, 0x01],     // ESC E 1
  BOLD_OFF:        [ESC, 0x45, 0x00],     // ESC E 0
  UNDERLINE_ON:    [ESC, 0x2D, 0x01],
  UNDERLINE_OFF:   [ESC, 0x2D, 0x00],
  FONT_SIZE_RESET: [GS,  0x21, 0x00],     // GS ! 0  — normal 1x1
  FEED_LINE:       [LF],
  CUT_FULL:        [GS,  0x56, 0x00],     // GS V 0
  CUT_PARTIAL:     [GS,  0x56, 0x01],     // GS V 1
  // Raster image: GS v 0  (args follow)
  RASTER_IMAGE:    [GS,  0x76, 0x30, 0x00],
  // QR code: GS ( k subcommands follow
  QR_MODEL:        [GS,  0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00],
  QR_SIZE:         [GS,  0x28, 0x6B, 0x03, 0x00, 0x31, 0x43],  // append size byte
  QR_CORRECTION:   [GS,  0x28, 0x6B, 0x03, 0x00, 0x31, 0x45],  // append level byte
  QR_STORE_PREFIX: [GS,  0x28, 0x6B],                           // length follows
  QR_PRINT:        [GS,  0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30],
  // Barcode: GS k
  BARCODE:         [GS,  0x6B],
  // Cash drawer: ESC p
  CASH_DRAWER:     [ESC, 0x70, 0x00, 0x19, 0xFA],
  // Codepage: ESC t
  SET_CODEPAGE:    [ESC, 0x74],
} as const;
```

---

## Layer 1 — `encoder.ts`

Converts a JS string to bytes for the selected codepage.

```ts
export type Codepage = 'cp437' | 'cp858' | 'gbk' | 'utf8';

export function encode(text: string, codepage: Codepage = 'cp437'): Uint8Array

// Maps a codepage name to the ESC t n byte the printer expects
export function codepageByte(codepage: Codepage): number
```

Implementation notes:
- `utf8`: `TextEncoder` (native in RN hermes)
- `cp437`: lookup table (256-entry map, ASCII 0-127 pass-through, 128-255 mapped)
- `cp858`: cp437 variant, 0xD5 = €
- `gbk`: require a 20 KB lookup table (lazy-load or tree-shaken)

---

## Layer 1 — `builder.ts`

The core byte-builder.  Pure class: takes a `PrinterProfile`, emits `Uint8Array`.

```ts
export class CommandBuilder {
  constructor(profile: PrinterProfile)

  // ── State mutators (all return `this` for chaining) ──────────────────────
  init(): this                            // ESC @
  codepage(cp: Codepage): this           // ESC t n
  align(a: 'left' | 'center' | 'right'): this
  bold(on: boolean): this
  underline(on: boolean): this
  size(w: 1|2, h: 1|2): this            // GS ! — double-wide / double-high
  feed(lines?: number): this             // ESC d n
  newline(): this                        // LF
  cut(mode?: 'full' | 'partial'): this  // uses profile default if omitted

  // ── Content ──────────────────────────────────────────────────────────────
  text(s: string): this                  // encode + append bytes
  raw(bytes: number[]): this             // escape hatch for custom commands

  // ── Rich content ─────────────────────────────────────────────────────────
  image(bitmap: BitmapData): this        // GS v 0 raster
  qr(data: string, size?: number, correction?: 'L'|'M'|'Q'|'H'): this
  barcode(type: BarcodeType, data: string): this
  cashDrawer(): this                     // ESC p pulse

  // ── Output ───────────────────────────────────────────────────────────────
  build(): Uint8Array
  debugHex(): string                     // "1B 40 1B 61 01 …"  — for debugging
}
```

`PrinterProfile` (defined in `types.ts`):

```ts
export interface PrinterProfile {
  name: string            // 'generic' | 'epson' | 'rongta'
  charWidth: number       // chars per line (32 for 58mm, 48 for 80mm)
  codepage: Codepage
  cutMode: 'full' | 'partial' | 'none'
  feedBeforeCut: number   // LF count before cut command
  supportsRaster: boolean // GS v 0 supported?
  supportsQR: boolean
}
```

---

## Layer 1 — `formatter/wrap.ts`

```ts
// Wraps text to maxChars, splitting on word boundaries
export function wrapText(text: string, maxChars: number): string[]

// Hard-truncates to maxChars with optional ellipsis
export function truncate(text: string, maxChars: number, ellipsis = '…'): string
```

---

## Layer 1 — `formatter/columns.ts`

```ts
export interface ColumnDef {
  text: string
  width: number          // fraction of total line (0.0–1.0), must sum to ≤1.0
  align?: 'left' | 'right' | 'center'
  overflow?: 'truncate' | 'wrap'   // default: truncate
}

// Formats a single row of columns into a padded string of exactly `lineWidth` chars.
// Handles overflow by truncating or wrapping.
export function formatColumns(cols: ColumnDef[], lineWidth: number): string[]

// Convenience: left label + right value (2-column, full width)
export function formatRow(label: string, value: string, lineWidth: number): string
```

---

## Layer 2 — `receipt/elements.ts`

DSL element type union and factory functions:

```ts
// ── Element types ──────────────────────────────────────────────────────────

type TextEl     = { kind: 'text';     content: string; bold?: boolean; size?: 1|2; align?: Align }
type RowEl      = { kind: 'row';      label: string;   value: string;  bold?: boolean }
type DividerEl  = { kind: 'divider';  char?: string }   // default '─'
type HeaderEl   = { kind: 'header';   char?: string }   // default '═'
type SpaceEl    = { kind: 'space';    lines?: number }  // default 1
type TotalEl    = { kind: 'total';    label: string;   value: string }
type QREl       = { kind: 'qr';       data: string;    size?: number; correction?: 'L'|'M'|'Q'|'H' }
type BarcodeEl  = { kind: 'barcode';  type: BarcodeType; data: string }
type ImageEl    = { kind: 'image';    bitmap: BitmapData }
type RawEl      = { kind: 'raw';      bytes: number[] }

export type ReceiptElement =
  | TextEl | RowEl | DividerEl | HeaderEl | SpaceEl
  | TotalEl | QREl | BarcodeEl | ImageEl | RawEl

// ── Factory functions ──────────────────────────────────────────────────────

export const text    = (content: string, opts?: Partial<TextEl>): TextEl     => ...
export const row     = (label: string, value: string, opts?: Partial<RowEl>): RowEl => ...
export const divider = (char?: string): DividerEl  => ...
export const header  = (char?: string): HeaderEl   => ...
export const space   = (lines?: number): SpaceEl   => ...
export const total   = (label: string, value: string): TotalEl  => ...
export const qr      = (data: string, opts?: Partial<QREl>): QREl  => ...
export const barcode = (type: BarcodeType, data: string): BarcodeEl => ...
export const image   = (bitmap: BitmapData): ImageEl  => ...
export const raw     = (bytes: number[]): RawEl  => ...
```

---

## Layer 2 — `receipt/dsl.ts`

```ts
export interface ReceiptOptions {
  profile: PrinterProfile
  codepage?: Codepage
}

// Compiles a list of elements into a complete ESC/POS Uint8Array.
// Handles: ESC @  init → elements → feed → cut
export function receipt(
  elements: ReceiptElement[],
  options: ReceiptOptions,
): Uint8Array
```

Internal render logic (each element → `CommandBuilder` calls):

| Element   | Builder calls |
|-----------|--------------|
| `text`    | `align()` + `bold()` + `size()` + `text()` + `newline()` |
| `row`     | `formatRow()` then `text()` + `newline()` |
| `divider` | `text(char.repeat(lineWidth))` + `newline()` |
| `header`  | `text(char.repeat(lineWidth))` + `newline()` |
| `space`   | `feed(lines)` |
| `total`   | `bold(true)` + `size(1,2)` + `formatRow()` + `newline()` + reset |
| `qr`      | `qr(data, size, correction)` |
| `barcode` | `barcode(type, data)` |
| `image`   | `image(bitmap)` |
| `raw`     | `raw(bytes)` |

---

## Image Printing Pipeline

Since we're in React Native (no Node.js `canvas`), image processing uses a
platform-agnostic approach:

```
Input (base64 PNG / URI)
  ↓
Resize to fit printer width (keep aspect ratio)
  ↓
Convert to grayscale: Y = 0.299R + 0.587G + 0.114B
  ↓
Threshold (default 127): pixel ≥ 127 → white (0), < 127 → black (1)
  ↓
Pack 8 pixels per byte (MSB first, left-to-right)
  ↓
Build GS v 0 raster command:
  [GS 0x76 0x30 mode widthLow widthHigh heightLow heightHigh ...data]
```

`BitmapData` type:
```ts
export interface BitmapData {
  width: number    // pixels
  height: number   // pixels
  data: Uint8Array // packed 1bpp, row-major, MSB-left
}
```

Image utility (used by DSL, not exported from barrel):
```ts
// lib/escpos/formatter/image.ts
export async function uriToBitmap(
  uri: string,
  maxWidthPx: number,
): Promise<BitmapData>
```

This will use `expo-image-manipulator` (already available via Expo) to resize,
then manual pixel iteration for grayscale + threshold.

---

## QR Code Commands

The GS ( k sequence for Model 2 QR:

```
GS ( k  4 0  49 65 50 0     — model 2
GS ( k  3 0  49 67 <size>   — module size (1–16)
GS ( k  3 0  49 69 <level>  — error correction (48=L, 49=M, 50=Q, 51=H)
GS ( k  <pL pH>  49 80 48 <data bytes>   — store data
GS ( k  3 0  49 81 48       — print stored symbol
```

Length bytes `pL pH` = `(data.length + 3)` split into low/high bytes.

---

## Barcode Commands

```ts
export type BarcodeType =
  | 'UPC_A'   // 0x00
  | 'EAN13'   // 0x02
  | 'CODE39'  // 0x04
  | 'ITF'     // 0x05
  | 'CODE128' // 0x49  (use GS k m NUL-terminated or length-prefixed)

// GS k <type> <data> NUL  (legacy format)
// GS k <type+65> <len> <data>  (modern, length-prefixed — preferred)
```

---

## Layer 3 — `transport/types.ts`

```ts
export interface PrintTransport {
  send(bytes: Uint8Array): Promise<void>
  disconnect(): Promise<void>
}

export interface TransportOptions {
  chunkSize?: number   // default 512
  chunkDelayMs?: number // default 50
}
```

---

## Layer 3 — `transport/bluetooth.ts`

```ts
export class BluetoothTransport implements PrintTransport {
  constructor(
    address: string,           // raw MAC or BT:AA:BB:CC:DD:EE:FF
    options?: TransportOptions
  )

  // Connects, chunks+sends, disconnects
  async send(bytes: Uint8Array): Promise<void>
  async disconnect(): Promise<void>
}

// Standalone utility (also used internally)
export async function sendInChunks(
  device: BluetoothDevice,
  buffer: Uint8Array,
  chunkSize = 512,
  delayMs = 50,
): Promise<void>
```

Chunking implementation:
```ts
for (let offset = 0; offset < buffer.length; offset += chunkSize) {
  const chunk = buffer.slice(offset, offset + chunkSize)
  await device.write(Buffer.from(chunk))
  if (offset + chunkSize < buffer.length) {
    await new Promise(r => setTimeout(r, delayMs))
  }
}
```

---

## Printer Profiles — `profiles/`

```ts
// generic.ts — safe defaults that work on most cheap printers
export const GENERIC_PROFILE_58: PrinterProfile = {
  name: 'generic',
  charWidth: 32,
  codepage: 'cp437',
  cutMode: 'partial',
  feedBeforeCut: 3,
  supportsRaster: true,
  supportsQR: true,
}

export const GENERIC_PROFILE_80: PrinterProfile = {
  ...GENERIC_PROFILE_58,
  charWidth: 48,
}

// epson.ts — Epson TM series
export const EPSON_PROFILE_80: PrinterProfile = {
  name: 'epson',
  charWidth: 48,
  codepage: 'cp437',
  cutMode: 'full',
  feedBeforeCut: 0,   // Epson handles feed internally on CUT_FEED
  supportsRaster: true,
  supportsQR: true,
}

// rongta.ts — Rongta, Xprinter cheap generics
export const RONGTA_PROFILE_80: PrinterProfile = {
  name: 'rongta',
  charWidth: 48,
  codepage: 'cp437',
  cutMode: 'partial',
  feedBeforeCut: 4,
  supportsRaster: true,
  supportsQR: true,
}
```

---

## `index.ts` — Public API Barrel

```ts
// Types
export type { PrinterProfile, Codepage, BitmapData, BarcodeType } from './types'
export type { ReceiptElement, ReceiptOptions } from './receipt/elements'
export type { PrintTransport, TransportOptions } from './transport/types'

// Layer 1 — Builder
export { CommandBuilder } from './builder'

// Layer 2 — DSL
export { receipt } from './receipt/dsl'
export {
  text, row, divider, header, space, total, qr, barcode, image, raw
} from './receipt/elements'

// Layer 3 — Transport
export { BluetoothTransport, sendInChunks } from './transport/bluetooth'

// Profiles
export {
  GENERIC_PROFILE_58, GENERIC_PROFILE_80,
  EPSON_PROFILE_80,
  RONGTA_PROFILE_80,
} from './profiles/generic'

// Utilities
export { encode, codepageByte } from './encoder'
export { wrapText, truncate } from './formatter/wrap'
export { formatColumns, formatRow } from './formatter/columns'
```

---

## Integration with Existing Code

### `lib/printer.ts` — after library is ready

Replace `formatKOT` / `formatBill` / `buildKOTJob` / `buildBillJob` with DSL calls:

```ts
import { receipt, text, row, divider, header, total, space } from '@/lib/escpos'
import { GENERIC_PROFILE_80 } from '@/lib/escpos'

function buildKOTBytes(params: KOTParams, profile: PrinterProfile): Uint8Array {
  return receipt([
    header(),
    text('KITCHEN ORDER TICKET', { align: 'center', bold: true, size: 2 }),
    header(),
    text(`KOT   : ${params.ticketNumber}`),
    text(`Order : ${params.orderNumber}`),
    // …items…
    space(3),
  ], { profile })
}
```

### `lib/bluetooth.ts` — `runRawPrinterJob`

Replace with `BluetoothTransport`:

```ts
import { BluetoothTransport } from '@/lib/escpos'

const transport = new BluetoothTransport(mac)
await transport.send(bytes)
```

---

## Debugging

`CommandBuilder.debugHex()` returns the full byte stream as a hex string:

```
1B 40 1B 61 01 48 65 6C 6C 6F 0A 1D 56 01
```

This should be logged via `addBreadcrumb` on every print job in dev builds.

---

## Implementation Order

1. `commands.ts` — byte constants (no deps, can test immediately)
2. `types.ts` — shared types
3. `encoder.ts` — CP437 table + UTF-8 fallback
4. `formatter/wrap.ts` — wrapText, truncate
5. `formatter/columns.ts` — formatRow, formatColumns
6. `builder.ts` — CommandBuilder (text, align, bold, size, feed, cut, qr, barcode, raw, debugHex)
7. `profiles/` — generic, epson, rongta
8. `receipt/elements.ts` — DSL types + factories
9. `receipt/dsl.ts` — receipt() compiler
10. `transport/bluetooth.ts` — BluetoothTransport with chunking
11. `formatter/image.ts` — uriToBitmap + bitmap element support
12. `index.ts` — barrel
13. Update `lib/printer.ts` to use DSL
14. Update `lib/bluetooth.ts` to use BluetoothTransport

---

## What This Replaces

| Old | New |
|-----|-----|
| `formatKOT()` → plain string | `receipt([...])` → `Uint8Array` |
| `formatBill()` → plain string | `receipt([...])` → `Uint8Array` |
| `buildKOTJob(printer, ...)` (Epson SDK) | `receipt([...])` + `BluetoothTransport` |
| `buildBillJob(printer, ...)` (Epson SDK) | same |
| `runRawPrinterJob()` — raw string via SPP | `BluetoothTransport.send(bytes)` |
| Manual `Buffer.from([0x1B, 0x40, ...])` | `CommandBuilder.raw([...])` |

The Epson SDK path (`runPrinterJob` / `Printer`) can remain for Epson-specific
users who want advanced status polling — the library does not require removing it.
