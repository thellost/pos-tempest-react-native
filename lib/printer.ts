import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Printer,
  TextAlignType,
  CommonParams,
  PrinterAddCutType,
} from 'react-native-esc-pos-printer';
import type { TrueFalseParam } from 'react-native-esc-pos-printer';

import { addBreadcrumb } from '@/lib/sentry';
import { runPrinterJob, openCashDrawerViaBluetooth } from '@/lib/bluetooth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrinterType = 'kitchen' | 'cashier';
export type PaperWidth = '58mm' | '80mm';

export interface PrinterConfig {
  address: string;
  name?: string;
  type: PrinterType;
}

export interface PrinterSettings {
  kitchenPrinter: PrinterConfig | null;
  cashierPrinter: PrinterConfig | null;
  paperWidth: PaperWidth;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@pos_tempest/printer_settings';

const DEFAULTS: PrinterSettings = {
  kitchenPrinter: null,
  cashierPrinter: null,
  paperWidth: '80mm',
};

export async function getPrinterSettings(): Promise<PrinterSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function savePrinterSettings(
  patch: Partial<PrinterSettings>,
): Promise<void> {
  const current = await getPrinterSettings();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...current, ...patch }),
  );
}

export async function setPrinter(
  type: PrinterType,
  config: PrinterConfig | null,
): Promise<void> {
  if (type === 'kitchen') {
    await savePrinterSettings({ kitchenPrinter: config });
  } else {
    await savePrinterSettings({ cashierPrinter: config });
  }
}

export async function clearPrinter(type: PrinterType): Promise<void> {
  await setPrinter(type, null);
}

export async function setPaperWidth(width: PaperWidth): Promise<void> {
  await savePrinterSettings({ paperWidth: width });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function charWidth(paperWidth: PaperWidth): number {
  return paperWidth === '80mm' ? 42 : 32;
}

const idr = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

// ── ESC/POS text formatters (used by ReceiptPreview) ─────────────────────────

function pad(text: string, total: number, right = false): string {
  if (right) return text.slice(0, total).padStart(total);
  return text.slice(0, total).padEnd(total);
}

function center(text: string, w: number): string {
  const spaces = Math.max(0, Math.floor((w - text.length) / 2));
  return ' '.repeat(spaces) + text;
}

/**
 * Returns a plain-text ESC/POS string for a KOT — used by ReceiptPreview.
 */
export function formatKOT(params: {
  ticketNumber: string;
  orderNumber: string;
  roundNumber: number;
  tableLabel: string;
  time: string;
  isTakeaway: boolean;
  items: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
    notes: string | null;
  }>;
  paperWidth: PaperWidth;
}): string {
  const w = charWidth(params.paperWidth);
  const H = '═'.repeat(w);
  const L = '─'.repeat(w);
  const lines: string[] = [
    H,
    center('KITCHEN ORDER TICKET', w),
    H,
    `KOT   : ${params.ticketNumber}`,
    `Order : ${params.orderNumber}`,
    `Round : ${params.roundNumber}`,
    `Table : ${params.tableLabel}`,
    `Time  : ${params.time}`,
    `Type  : ${params.isTakeaway ? 'Takeaway' : 'Dine-in'}`,
    L,
  ];

  for (const item of params.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    for (const mod of item.modifiers) lines.push(`   • ${mod}`);
    if (item.notes) lines.push(`   * ${item.notes}`);
  }

  lines.push(H);
  return lines.join('\n');
}

/**
 * Returns a plain-text ESC/POS string for a bill — used by ReceiptPreview.
 */
export function formatBill(params: {
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  orderNumber: string;
  tableLabel: string;
  cashierName: string;
  printedAt: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    modifiers: string[];
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;
  roundingAmount: number;
  total: number;
  payments?: Array<{ method: string; amount: number; changeAmount: number }>;
  paperWidth: PaperWidth;
}): string {
  const w = charWidth(params.paperWidth);
  const H = '═'.repeat(w);
  const L = '─'.repeat(w);
  const row = (label: string, value: string) =>
    `${pad(label, w - value.length)}${value}`;

  const lines: string[] = [
    H,
    center(params.branchName.toUpperCase(), w),
  ];
  if (params.branchAddress) lines.push(center(params.branchAddress, w));
  if (params.branchPhone)   lines.push(center(params.branchPhone, w));
  lines.push(
    H,
    `Order : ${params.orderNumber}`,
    `Table : ${params.tableLabel}`,
    `Staff : ${params.cashierName}`,
    `Time  : ${params.printedAt}`,
    L,
  );

  for (const item of params.items) {
    const priceStr = idr(item.total);
    lines.push(`${item.quantity}x ${pad(item.name, w - priceStr.length - 3)} ${priceStr}`);
    for (const mod of item.modifiers) lines.push(`   ${mod}`);
  }

  lines.push(L, row('Subtotal', idr(params.subtotal)));
  if (params.discountAmount > 0) lines.push(row('Diskon', `-${idr(params.discountAmount)}`));
  if (params.taxAmount > 0)      lines.push(row('Pajak (11%)', idr(params.taxAmount)));
  if (params.serviceCharge > 0)  lines.push(row('Servis', idr(params.serviceCharge)));
  if (params.roundingAmount !== 0) lines.push(row('Pembulatan', idr(params.roundingAmount)));

  lines.push(H, row('TOTAL', idr(params.total)), H);

  if (params.payments && params.payments.length > 0) {
    lines.push(L);
    for (const p of params.payments) {
      lines.push(row(`Bayar (${p.method})`, idr(p.amount)));
      if (p.changeAmount > 0) lines.push(row('Kembalian', idr(p.changeAmount)));
    }
    lines.push(L);
  }

  lines.push('', center('Terima kasih! 🙏', w), center('Sampai jumpa kembali', w), H);
  return lines.join('\n');
}

// ── Print job builders ────────────────────────────────────────────────────────
// These build the actual hardware print job using the ePOS SDK formatting API
// instead of raw text strings.

async function buildKOTJob(
  printer: Printer,
  params: Parameters<typeof formatKOT>[0],
): Promise<void> {
  const w = charWidth(params.paperWidth);
  const H = '═'.repeat(w) + '\n';
  const L = '─'.repeat(w) + '\n';

  // ── Header ──
  await printer.addText(H);
  await printer.addTextAlign(TextAlignType.ALIGN_CENTER);
  await printer.addTextSize({ width: 1, height: 2 });
  await printer.addTextStyle({ em: CommonParams.TRUE as TrueFalseParam });
  await printer.addText('KITCHEN ORDER TICKET\n');
  await printer.addTextStyle({ em: CommonParams.FALSE as TrueFalseParam });
  await printer.addTextSize({ width: 1, height: 1 });
  await printer.addTextAlign(TextAlignType.ALIGN_LEFT);
  await printer.addText(H);

  // ── Meta ──
  await printer.addText(`KOT   : ${params.ticketNumber}\n`);
  await printer.addText(`Order : ${params.orderNumber}\n`);
  await printer.addText(`Round : ${params.roundNumber}\n`);
  await printer.addText(`Table : ${params.tableLabel}\n`);
  await printer.addText(`Time  : ${params.time}\n`);
  await printer.addText(`Type  : ${params.isTakeaway ? 'Takeaway' : 'Dine-in'}\n`);
  await printer.addText(L);

  // ── Items ──
  for (const item of params.items) {
    await printer.addTextStyle({ em: CommonParams.TRUE as TrueFalseParam });
    await printer.addText(`${item.quantity}x ${item.name}\n`);
    await printer.addTextStyle({ em: CommonParams.FALSE as TrueFalseParam });
    for (const mod of item.modifiers) {
      await printer.addText(`   \u2022 ${mod}\n`);
    }
    if (item.notes) {
      await printer.addText(`   * ${item.notes}\n`);
    }
  }

  await printer.addText(H);
  await printer.addFeedLine(3);
  await printer.addCut(PrinterAddCutType.CUT_FEED);
}

async function buildBillJob(
  printer: Printer,
  params: Parameters<typeof formatBill>[0],
): Promise<void> {
  const w = charWidth(params.paperWidth);
  const H = '═'.repeat(w) + '\n';
  const L = '─'.repeat(w) + '\n';

  // ── Branch header ──
  await printer.addText(H);
  await printer.addTextAlign(TextAlignType.ALIGN_CENTER);
  await printer.addTextStyle({ em: CommonParams.TRUE as TrueFalseParam });
  await printer.addTextSize({ width: 1, height: 2 });
  await printer.addText(`${params.branchName.toUpperCase()}\n`);
  await printer.addTextSize({ width: 1, height: 1 });
  await printer.addTextStyle({ em: CommonParams.FALSE as TrueFalseParam });
  if (params.branchAddress) await printer.addText(`${params.branchAddress}\n`);
  if (params.branchPhone)   await printer.addText(`${params.branchPhone}\n`);
  await printer.addTextAlign(TextAlignType.ALIGN_LEFT);
  await printer.addText(H);

  // ── Order meta ──
  await printer.addText(`Order : ${params.orderNumber}\n`);
  await printer.addText(`Table : ${params.tableLabel}\n`);
  await printer.addText(`Staff : ${params.cashierName}\n`);
  await printer.addText(`Time  : ${params.printedAt}\n`);
  await printer.addText(L);

  // ── Items ──
  for (const item of params.items) {
    await printer.addTextStyle({ em: CommonParams.TRUE as TrueFalseParam });
    await Printer.addTextLine(printer, {
      left: `${item.quantity}x ${item.name}`,
      right: idr(item.total),
    });
    await printer.addText('\n');
    await printer.addTextStyle({ em: CommonParams.FALSE as TrueFalseParam });
    for (const mod of item.modifiers) {
      await printer.addText(`   ${mod}\n`);
    }
  }

  await printer.addText(L);

  // ── Totals ──
  await Printer.addTextLine(printer, { left: 'Subtotal', right: idr(params.subtotal) });
  await printer.addText('\n');
  if (params.discountAmount > 0) {
    await Printer.addTextLine(printer, { left: 'Diskon', right: `-${idr(params.discountAmount)}` });
    await printer.addText('\n');
  }
  if (params.taxAmount > 0) {
    await Printer.addTextLine(printer, { left: 'Pajak (11%)', right: idr(params.taxAmount) });
    await printer.addText('\n');
  }
  if (params.serviceCharge > 0) {
    await Printer.addTextLine(printer, { left: 'Servis', right: idr(params.serviceCharge) });
    await printer.addText('\n');
  }
  if (params.roundingAmount !== 0) {
    await Printer.addTextLine(printer, { left: 'Pembulatan', right: idr(params.roundingAmount) });
    await printer.addText('\n');
  }

  // ── Grand total ──
  await printer.addText(H);
  await printer.addTextStyle({ em: CommonParams.TRUE as TrueFalseParam });
  await printer.addTextSize({ width: 1, height: 2 });
  await Printer.addTextLine(printer, { left: 'TOTAL', right: idr(params.total) });
  await printer.addText('\n');
  await printer.addTextSize({ width: 1, height: 1 });
  await printer.addTextStyle({ em: CommonParams.FALSE as TrueFalseParam });
  await printer.addText(H);

  // ── Payments ──
  if (params.payments && params.payments.length > 0) {
    await printer.addText(L);
    for (const p of params.payments) {
      await Printer.addTextLine(printer, { left: `Bayar (${p.method})`, right: idr(p.amount) });
      await printer.addText('\n');
      if (p.changeAmount > 0) {
        await Printer.addTextLine(printer, { left: 'Kembalian', right: idr(p.changeAmount) });
        await printer.addText('\n');
      }
    }
    await printer.addText(L);
  }

  // ── Footer ──
  await printer.addTextAlign(TextAlignType.ALIGN_CENTER);
  await printer.addText('\nTerima kasih!\nSampai jumpa kembali\n');
  await printer.addTextAlign(TextAlignType.ALIGN_LEFT);
  await printer.addText(H);
  await printer.addFeedLine(3);
  await printer.addCut(PrinterAddCutType.CUT_FEED);
}

// ── Public print functions ────────────────────────────────────────────────────

async function getConfig(type: PrinterType): Promise<PrinterConfig | null> {
  const settings = await getPrinterSettings();
  return type === 'kitchen' ? settings.kitchenPrinter : settings.cashierPrinter;
}

/**
 * Prints a Kitchen Order Ticket to the configured printer.
 */
export async function printKOT(
  type: PrinterType,
  params: Parameters<typeof formatKOT>[0],
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'KOT print skipped — no printer configured', { type }, 'warning');
    return;
  }
  await runPrinterJob(cfg.address, cfg.name ?? cfg.address, (p) => buildKOTJob(p, params));
}

/**
 * Prints a customer bill to the configured printer.
 */
export async function printBill(
  type: PrinterType,
  params: Parameters<typeof formatBill>[0],
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Bill print skipped — no printer configured', { type }, 'warning');
    return;
  }
  await runPrinterJob(cfg.address, cfg.name ?? cfg.address, (p) => buildBillJob(p, params));
}

/**
 * Sends a raw text string to the configured printer.
 * Use for simple test prints; prefer printKOT / printBill for real jobs.
 */
export async function sendToPrinter(
  type: PrinterType,
  data: string,
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Print skipped — no printer configured', { type }, 'warning');
    console.warn(`[Printer] No ${type} printer configured — skipping print`);
    return;
  }

  await runPrinterJob(cfg.address, cfg.name ?? cfg.address, async (printer) => {
    await printer.addText(data);
    await printer.addFeedLine(3);
    await printer.addCut(PrinterAddCutType.CUT_FEED);
  });
}

/**
 * Opens the cash drawer via an ESC/POS kick command sent to the cashier printer.
 */
export async function openCashDrawer(): Promise<void> {
  const cfg = await getConfig('cashier');
  if (!cfg) {
    console.warn('[Printer] No cashier printer configured — cannot open cash drawer');
    return;
  }
  await openCashDrawerViaBluetooth(cfg.address, cfg.name ?? cfg.address);
}
