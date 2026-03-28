/**
 * lib/escpos/encoder.ts
 *
 * Converts JS strings to printer bytes for various codepages.
 *
 * ESC/POS printers are NOT UTF-8 by default.  The safe universal choice is
 * CP437 (original IBM PC character set).  For printers that understand UTF-8
 * (rare), use 'utf8'.  For Chinese printers, use 'gbk'.
 *
 * Strategy:
 *  - cp437 / cp858 : lookup table (fast, no deps, ASCII pass-through)
 *  - utf8          : TextEncoder (native in Hermes / React Native)
 *  - gbk           : lookup table (subset — printable ASCII + common CJK)
 */

import type { Codepage } from './types';

// ── CP437 encode table ────────────────────────────────────────────────────────
//
// Maps Unicode code points 128-255 to their CP437 byte equivalents.
// Characters outside this range (and not in ASCII 0-127) are replaced with '?'.
// Source: https://en.wikipedia.org/wiki/Code_page_437

const CP437_UNICODE_TO_BYTE: Record<number, number> = {
  // Row 8x
  0x00c7: 0x80, // Ç
  0x00fc: 0x81, // ü
  0x00e9: 0x82, // é
  0x00e2: 0x83, // â
  0x00e4: 0x84, // ä
  0x00e0: 0x85, // à
  0x00e5: 0x86, // å
  0x00e7: 0x87, // ç
  0x00ea: 0x88, // ê
  0x00eb: 0x89, // ë
  0x00e8: 0x8a, // è
  0x00ef: 0x8b, // ï
  0x00ee: 0x8c, // î
  0x00ec: 0x8d, // ì
  0x00c4: 0x8e, // Ä
  0x00c5: 0x8f, // Å
  // Row 9x
  0x00c9: 0x90, // É
  0x00e6: 0x91, // æ
  0x00c6: 0x92, // Æ
  0x00f4: 0x93, // ô
  0x00f6: 0x94, // ö
  0x00f2: 0x95, // ò
  0x00fb: 0x96, // û
  0x00f9: 0x97, // ù
  0x00ff: 0x98, // ÿ
  0x00d6: 0x99, // Ö
  0x00dc: 0x9a, // Ü
  0x00a2: 0x9b, // ¢
  0x00a3: 0x9c, // £
  0x00a5: 0x9d, // ¥
  0x20a7: 0x9e, // ₧
  0x0192: 0x9f, // ƒ
  // Row Ax
  0x00e1: 0xa0, // á
  0x00ed: 0xa1, // í
  0x00f3: 0xa2, // ó
  0x00fa: 0xa3, // ú
  0x00f1: 0xa4, // ñ
  0x00d1: 0xa5, // Ñ
  0x00aa: 0xa6, // ª
  0x00ba: 0xa7, // º
  0x00bf: 0xa8, // ¿
  0x2310: 0xa9, // ⌐
  0x00ac: 0xaa, // ¬
  0x00bd: 0xab, // ½
  0x00bc: 0xac, // ¼
  0x00a1: 0xad, // ¡
  0x00ab: 0xae, // «
  0x00bb: 0xaf, // »
  // Row Bx–Ex: box-drawing chars (commonly used in receipts!)
  0x2591: 0xb0, 0x2592: 0xb1, 0x2593: 0xb2, 0x2502: 0xb3,
  0x2524: 0xb4, 0x2561: 0xb5, 0x2562: 0xb6, 0x2556: 0xb7,
  0x2555: 0xb8, 0x2563: 0xb9, 0x2551: 0xba, 0x2557: 0xbb,
  0x255d: 0xbc, 0x255c: 0xbd, 0x255b: 0xbe, 0x2510: 0xbf,
  0x2514: 0xc0, 0x2534: 0xc1, 0x252c: 0xc2, 0x251c: 0xc3,
  0x2500: 0xc4, 0x253c: 0xc5, 0x255e: 0xc6, 0x255f: 0xc7,
  0x255a: 0xc8, 0x2554: 0xc9, 0x2569: 0xca, 0x2566: 0xcb,
  0x2560: 0xcc, 0x2550: 0xcd, 0x256c: 0xce, 0x2567: 0xcf,
  0x2568: 0xd0, 0x2564: 0xd1, 0x2565: 0xd2, 0x2559: 0xd3,
  0x2558: 0xd4, 0x2552: 0xd5, 0x2553: 0xd6, 0x256b: 0xd7,
  0x256a: 0xd8, 0x2518: 0xd9, 0x250c: 0xda, 0x2588: 0xdb,
  0x2584: 0xdc, 0x258c: 0xdd, 0x2590: 0xde, 0x2580: 0xdf,
  // Row Ex
  0x03b1: 0xe0, // α
  0x00df: 0xe1, // ß
  0x0393: 0xe2, // Γ
  0x03c0: 0xe3, // π
  0x03a3: 0xe4, // Σ
  0x03c3: 0xe5, // σ
  0x00b5: 0xe6, // µ
  0x03c4: 0xe7, // τ
  0x03a6: 0xe8, // Φ
  0x0398: 0xe9, // Θ
  0x03a9: 0xea, // Ω
  0x03b4: 0xeb, // δ
  0x221e: 0xec, // ∞
  0x03c6: 0xed, // φ
  0x03b5: 0xee, // ε
  0x2229: 0xef, // ∩
  // Row Fx
  0x2261: 0xf0, // ≡
  0x00b1: 0xf1, // ±
  0x2265: 0xf2, // ≥
  0x2264: 0xf3, // ≤
  0x2320: 0xf4, // ⌠
  0x2321: 0xf5, // ⌡
  0x00f7: 0xf6, // ÷
  0x2248: 0xf7, // ≈
  0x00b0: 0xf8, // °
  0x2219: 0xf9, // ∙
  0x00b7: 0xfa, // ·
  0x221a: 0xfb, // √
  0x207f: 0xfc, // ⁿ
  0x00b2: 0xfd, // ²
  0x25a0: 0xfe, // ■
  0x00a0: 0xff, // NBSP
};

// CP858 is CP437 with 0xD5 = € instead of ı
const CP858_EXTRAS: Record<number, number> = {
  0x20ac: 0xd5, // €  (replaces ı in CP437)
};

// ── Encode function ───────────────────────────────────────────────────────────

/**
 * Encodes a JS string to bytes for the given codepage.
 *
 * - ASCII characters (0x00–0x7F) are always pass-through.
 * - Unmappable characters are silently replaced with 0x3F ('?').
 */
export function encode(text: string, codepage: Codepage = 'cp437'): Uint8Array {
  if (codepage === 'utf8') {
    return new TextEncoder().encode(text);
  }

  const bytes: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? 0x3f;

    // Surrogate pair: codePointAt already advances past both surrogates,
    // but the loop index only advances by 1 — skip the low surrogate.
    if (cp > 0xffff) i++;

    if (cp <= 0x7f) {
      // ASCII pass-through
      bytes.push(cp);
      continue;
    }

    let byte: number | undefined;

    if (codepage === 'cp858') {
      byte = CP858_EXTRAS[cp] ?? CP437_UNICODE_TO_BYTE[cp];
    } else if (codepage === 'gbk') {
      byte = encodeGBK(cp);
    } else {
      // cp437
      byte = CP437_UNICODE_TO_BYTE[cp];
    }

    bytes.push(byte ?? 0x3f); // fallback: '?'
  }

  return new Uint8Array(bytes);
}

// ── Codepage byte (ESC t n) ───────────────────────────────────────────────────

/**
 * Returns the ESC t n byte for the given codepage.
 * Used by CommandBuilder.codepage() to select the active character table.
 */
export function codepageByte(cp: Codepage): number {
  switch (cp) {
    case 'cp437': return 0x00;
    case 'cp858': return 0x13;
    case 'gbk':   return 0xff; // printer-dependent; many use 0x0F or proprietary
    case 'utf8':  return 0x00; // UTF-8 printers often ignore ESC t; send as-is
    default:      return 0x00;
  }
}

// ── GBK encoding (minimal subset) ────────────────────────────────────────────
//
// Full GBK is ~20 KB of lookup tables.  We include only the printable ASCII
// pass-through here; CJK characters require the full table which should be
// lazy-loaded when needed.  This keeps the default bundle small.
//
// For production CJK support, replace this stub with a full GBK table or use
// a library such as `iconv-lite` (if bundled for React Native).

function encodeGBK(cp: number): number | undefined {
  // GBK is a superset of ASCII; code points ≤ 0x7F are identical.
  // For code points above 0x7F the full table would map each Unicode
  // code point to a 2-byte GBK sequence.  Returning undefined here
  // causes the caller to emit '?' — a safe degradation.
  if (cp <= 0x7f) return cp;
  return undefined; // TODO: full GBK table
}
