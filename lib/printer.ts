import AsyncStorage from '@react-native-async-storage/async-storage';

import { Config } from '@/constants/config';
import { addBreadcrumb, captureError } from '@/lib/sentry';
import {
  receipt, text, row, columns, divider, header, space, total,
  CommandBuilder, BluetoothTransport,
  GENERIC_PROFILE_58, GENERIC_PROFILE_80,
  type PrinterProfile,
  type ReceiptElement,
} from '@/lib/escpos';

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

const STORAGE_KEY = Config.STORAGE_KEY_PRINTER_SETTINGS;

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

// 80 mm at standard font = 42 chars; 58 mm = 32 chars
function charWidth(paperWidth: PaperWidth): number {
  return paperWidth === '80mm' ? 42 : 32;
}

// 80mm uses charWidth 42 to match existing receipt layout
function getProfile(paperWidth: PaperWidth): PrinterProfile {
  return paperWidth === '80mm'
    ? { ...GENERIC_PROFILE_80, charWidth: 42 }
    : GENERIC_PROFILE_58;
}

const idr = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

// ── ESC/POS text formatters (used by ReceiptPreview) ─────────────────────────
// These return plain text for on-screen display — not for sending to a printer.

function pad(text: string, total: number, right = false): string {
  if (right) return text.slice(0, total).padStart(total);
  return text.slice(0, total).padEnd(total);
}

function center(text: string, w: number): string {
  const spaces = Math.max(0, Math.floor((w - text.length) / 2));
  return ' '.repeat(spaces) + text;
}

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
    for (const mod of item.modifiers) lines.push(`   \u2022 ${mod}`);
    if (item.notes) lines.push(`   * ${item.notes}`);
  }

  lines.push(H);
  return lines.join('\n');
}

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
  const rowFn = (label: string, value: string) =>
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

  lines.push(L, rowFn('Subtotal', idr(params.subtotal)));
  if (params.discountAmount > 0)    lines.push(rowFn('Diskon',      `-${idr(params.discountAmount)}`));
  if (params.taxAmount > 0)         lines.push(rowFn('Pajak (11%)', idr(params.taxAmount)));
  if (params.serviceCharge > 0)     lines.push(rowFn('Servis',      idr(params.serviceCharge)));
  if (params.roundingAmount !== 0)  lines.push(rowFn('Pembulatan',  idr(params.roundingAmount)));

  lines.push(H, rowFn('TOTAL', idr(params.total)), H);

  if (params.payments && params.payments.length > 0) {
    lines.push(L);
    for (const p of params.payments) {
      lines.push(rowFn(`Bayar (${p.method})`, idr(p.amount)));
      if (p.changeAmount > 0) lines.push(rowFn('Kembalian', idr(p.changeAmount)));
    }
    lines.push(L);
  }

  lines.push('', center('Terima kasih! 🙏', w), center('Sampai jumpa kembali', w), H);
  return lines.join('\n');
}

// ── Byte builders ─────────────────────────────────────────────────────────────
// These produce the ESC/POS Uint8Array that is actually sent to the printer.

function buildKOTBytes(params: Parameters<typeof formatKOT>[0]): Uint8Array {
  const profile = getProfile(params.paperWidth);
  const els: ReceiptElement[] = [
    header(),
    text('KITCHEN ORDER TICKET', { align: 'center', bold: true, size: { width: 1, height: 2 } }),
    header(),
    text(`KOT   : ${params.ticketNumber}`),
    text(`Order : ${params.orderNumber}`),
    text(`Round : ${params.roundNumber}`),
    text(`Table : ${params.tableLabel}`),
    text(`Time  : ${params.time}`),
    text(`Type  : ${params.isTakeaway ? 'Takeaway' : 'Dine-in'}`),
    divider(),
  ];

  for (const item of params.items) {
    els.push(text(`${item.quantity}x ${item.name}`, { bold: true }));
    for (const mod of item.modifiers) {
      els.push(text(`   \u2022 ${mod}`));
    }
    if (item.notes) {
      els.push(text(`   * ${item.notes}`));
    }
  }

  els.push(header());
  return receipt(els, { profile });
}

function buildBillBytes(params: Parameters<typeof formatBill>[0]): Uint8Array {
  const profile = getProfile(params.paperWidth);
  const els: ReceiptElement[] = [
    header(),
    text(params.branchName.toUpperCase(), { align: 'center', bold: true, size: { width: 1, height: 2 } }),
  ];

  if (params.branchAddress) els.push(text(params.branchAddress, { align: 'center' }));
  if (params.branchPhone)   els.push(text(params.branchPhone,   { align: 'center' }));

  els.push(
    header(),
    text(`Order : ${params.orderNumber}`),
    text(`Table : ${params.tableLabel}`),
    text(`Staff : ${params.cashierName}`),
    text(`Time  : ${params.printedAt}`),
    divider(),
  );

  for (const item of params.items) {
    els.push(
      columns(
        [
          { text: `${item.quantity}x ${item.name}`, width: 0.65 },
          { text: idr(item.total), width: 0.35, align: 'right' },
        ],
        { bold: true },
      ),
    );
    for (const mod of item.modifiers) {
      els.push(text(`   ${mod}`));
    }
  }

  els.push(divider(), row('Subtotal', idr(params.subtotal)));
  if (params.discountAmount > 0)    els.push(row('Diskon',      `-${idr(params.discountAmount)}`));
  if (params.taxAmount > 0)         els.push(row('Pajak (11%)', idr(params.taxAmount)));
  if (params.serviceCharge > 0)     els.push(row('Servis',      idr(params.serviceCharge)));
  if (params.roundingAmount !== 0)  els.push(row('Pembulatan',  idr(params.roundingAmount)));

  els.push(header(), total('TOTAL', idr(params.total)), header());

  if (params.payments && params.payments.length > 0) {
    els.push(divider());
    for (const p of params.payments) {
      els.push(row(`Bayar (${p.method})`, idr(p.amount)));
      if (p.changeAmount > 0) els.push(row('Kembalian', idr(p.changeAmount)));
    }
    els.push(divider());
  }

  els.push(
    space(),
    text('Terima kasih!',        { align: 'center' }),
    text('Sampai jumpa kembali', { align: 'center' }),
    header(),
  );

  return receipt(els, { profile });
}

// ── Public print functions ────────────────────────────────────────────────────

async function getConfig(type: PrinterType): Promise<PrinterConfig | null> {
  const settings = await getPrinterSettings();
  return type === 'kitchen' ? settings.kitchenPrinter : settings.cashierPrinter;
}

export async function printKOT(
  type: PrinterType,
  params: Parameters<typeof formatKOT>[0],
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'KOT print skipped — no printer configured', { type }, 'warning');
    return;
  }
  try {
    await new BluetoothTransport(cfg.address).send(buildKOTBytes(params));
    addBreadcrumb('print', 'KOT printed', {
      type,
      address: cfg.address,
      ticketNumber: params.ticketNumber,
      orderNumber: params.orderNumber,
    });
  } catch (err) {
    captureError(err, {
      module: 'printer',
      operation: 'printKOT',
      extras: { type, address: cfg.address, ticketNumber: params.ticketNumber, orderNumber: params.orderNumber },
    });
    throw err;
  }
}

export async function printBill(
  type: PrinterType,
  params: Parameters<typeof formatBill>[0],
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Bill print skipped — no printer configured', { type }, 'warning');
    return;
  }
  try {
    await new BluetoothTransport(cfg.address).send(buildBillBytes(params));
    addBreadcrumb('print', 'Bill printed', {
      type,
      address: cfg.address,
      orderNumber: params.orderNumber,
      total: params.total,
    });
  } catch (err) {
    captureError(err, {
      module: 'printer',
      operation: 'printBill',
      extras: { type, address: cfg.address, orderNumber: params.orderNumber },
    });
    throw err;
  }
}

export async function sendToPrinter(
  type: PrinterType,
  data: string,
): Promise<void> {
  const [cfg, settings] = await Promise.all([getConfig(type), getPrinterSettings()]);
  if (!cfg) {
    addBreadcrumb('print', 'Print skipped — no printer configured', { type }, 'warning');
    console.warn(`[Printer] No ${type} printer configured — skipping print`);
    return;
  }
  try {
    const profile = getProfile(settings.paperWidth);
    const bytes = new CommandBuilder(profile).init().text(data).cut().build();
    await new BluetoothTransport(cfg.address).send(bytes);
    addBreadcrumb('print', 'Raw print sent', { type, address: cfg.address });
  } catch (err) {
    captureError(err, {
      module: 'printer',
      operation: 'sendToPrinter',
      extras: { type, address: cfg.address },
    });
    throw err;
  }
}

export async function printTestPage(
  type: PrinterType,
  paperWidth: PaperWidth,
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Test print skipped — no printer configured', { type }, 'warning');
    return;
  }
  const profile = getProfile(paperWidth);
  const now = new Date().toLocaleString('id-ID');
  const bytes = receipt([
    header(),
    text('TEST PRINT', { align: 'center', bold: true, size: { width: 1, height: 2 } }),
    header(),
    row('Printer', type),
    row('Paper',   paperWidth),
    row('Time',    now),
    divider(),
    text('POS Tempest', { align: 'center' }),
    header(),
  ], { profile });
  try {
    await new BluetoothTransport(cfg.address).send(bytes);
    addBreadcrumb('print', 'Test print sent', { type, address: cfg.address });
  } catch (err) {
    captureError(err, { module: 'printer', operation: 'printTestPage', extras: { type, address: cfg.address } });
    throw err;
  }
}

export async function openCashDrawer(): Promise<void> {
  const cfg = await getConfig('cashier');
  if (!cfg) {
    addBreadcrumb('print', 'Cash drawer open skipped — no cashier printer configured', {}, 'warning');
    return;
  }
  try {
    // ESC p — cash drawer pulse; no init needed (avoids paper advance)
    const bytes = new CommandBuilder(GENERIC_PROFILE_80).cashDrawer().build();
    await new BluetoothTransport(cfg.address).send(bytes);
    addBreadcrumb('print', 'Cash drawer opened', { address: cfg.address });
  } catch (err) {
    captureError(err, {
      module: 'printer',
      operation: 'openCashDrawer',
      extras: { address: cfg.address },
    });
    throw err;
  }
}
