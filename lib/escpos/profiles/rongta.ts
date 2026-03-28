/**
 * lib/escpos/profiles/rongta.ts
 *
 * Profiles for Rongta and Xprinter thermal printers.
 *
 * These printers accept standard ESC/POS but have a few quirks:
 * - They require more feed lines before cut (4) or the last line is clipped.
 * - Partial cut is more reliable than full cut on most models.
 * - QR and raster image support is present on RP-series but absent on
 *   very cheap RP-58 clones — set supportsQR/supportsRaster: false if needed.
 */

import type { PrinterProfile } from '../types';

/** Rongta RP-326 / RP-80US / Xprinter XP-58 — 58 mm */
export const RONGTA_PROFILE_58: PrinterProfile = {
  name: 'rongta',
  charWidth: 32,
  codepage: 'cp437',
  cutMode: 'partial',
  feedBeforeCut: 4,
  supportsRaster: true,
  supportsQR: true,
};

/** Rongta RP-80BE / RP-80US-II — 80 mm */
export const RONGTA_PROFILE_80: PrinterProfile = {
  ...RONGTA_PROFILE_58,
  charWidth: 48,
};
