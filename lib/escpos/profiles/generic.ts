/**
 * lib/escpos/profiles/generic.ts
 *
 * Safe default profiles for generic ESC/POS printers.
 * These settings are conservative: partial cut, pre-cut feeds, CP437.
 * They work on the vast majority of cheap Chinese thermal printers
 * (Xprinter, HOIN, Rongta budget models, etc.).
 */

import type { PrinterProfile } from '../types';

/** 58 mm paper — ~32 characters per line */
export const GENERIC_PROFILE_58: PrinterProfile = {
  name: 'generic',
  charWidth: 32,
  codepage: 'cp437',
  cutMode: 'partial',
  feedBeforeCut: 3,
  supportsRaster: true,
  supportsQR: true,
};

/** 80 mm paper — ~48 characters per line */
export const GENERIC_PROFILE_80: PrinterProfile = {
  ...GENERIC_PROFILE_58,
  charWidth: 48,
};
