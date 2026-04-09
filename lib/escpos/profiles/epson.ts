/**
 * lib/escpos/profiles/epson.ts
 *
 * Profiles for Epson TM-series thermal printers.
 *
 * Key differences from generic:
 * - Uses GS V A 0 (CUT_FEED) which combines feed + full cut in one command.
 *   feedBeforeCut is therefore 0 — the printer handles the feed internally.
 * - charWidth 42 for standard TM-T20/T82; use 48 for wide-mode or TM-T88.
 */

import type { PrinterProfile } from '../types';

/** Epson TM-T20 / TM-T82 — 80 mm, standard mode (~42 chars) */
export const EPSON_PROFILE_80: PrinterProfile = {
  name: 'epson',
  charWidth: 42,
  codepage: 'cp437',
  cutMode: 'feed',   // GS V A 0 — feed + full cut
  feedBeforeCut: 0,  // Epson's CUT_FEED handles feed internally
  supportsRaster: true,
  supportsQR: true,
};

/** Epson TM-T88 — 80 mm, wide mode (~48 chars) */
export const EPSON_PROFILE_80_WIDE: PrinterProfile = {
  ...EPSON_PROFILE_80,
  charWidth: 48,
};
