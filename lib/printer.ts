import AsyncStorage from '@react-native-async-storage/async-storage';

import { Config } from '@/constants/config';
import {
  barcode,
  BluetoothTransport,
  columns,
  CommandBuilder,
  divider,
  GENERIC_PROFILE_58, GENERIC_PROFILE_80,
  header,
  image, qr,
  receipt,
  row,
  space,
  text,
  total,
  wrapText,
  type PrinterProfile,
  type ReceiptElement,
} from '@/lib/escpos';
import { TEST_IMAGE_BITMAP } from '@/lib/escpos/test-image-data';
import { addBreadcrumb, captureError } from '@/lib/sentry';
import { formatReceiptDate } from '@/utils/date';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrinterType = 'kitchen' | 'cashier';
/** Paper width in millimetres, e.g. 58, 72, 76, 80 */
export type PaperWidth = number;

export interface PrinterConfig {
  address: string;
  name?: string;
  type: PrinterType;
  /** Paper width in mm for this specific printer */
  paperWidth: PaperWidth;
}

export interface PrinterSettings {
  kitchenPrinter: PrinterConfig | null;
  cashierPrinter: PrinterConfig | null;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = Config.STORAGE_KEY_PRINTER_SETTINGS;

const DEFAULT_PAPER_WIDTH: PaperWidth = 80;

const DEFAULTS: PrinterSettings = {
  kitchenPrinter: null,
  cashierPrinter: null,
};

function normalizePrinterConfig(cfg: PrinterConfig | null): PrinterConfig | null {
  if (!cfg) return null;
  return { ...cfg, paperWidth: cfg.paperWidth ?? DEFAULT_PAPER_WIDTH };
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>;
    return {
      ...DEFAULTS,
      ...parsed,
      kitchenPrinter: normalizePrinterConfig(parsed.kitchenPrinter ?? null),
      cashierPrinter: normalizePrinterConfig(parsed.cashierPrinter ?? null),
    };
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

export async function setPrinterPaperWidth(type: PrinterType, width: PaperWidth): Promise<void> {
  const settings = await getPrinterSettings();
  const cfg = type === 'kitchen' ? settings.kitchenPrinter : settings.cashierPrinter;
  if (!cfg) return;
  await setPrinter(type, { ...cfg, paperWidth: width });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Linear interpolation: 58mm→32 chars, 80mm→42 chars
function charWidth(mm: number): number {
  return Math.max(20, Math.round(32 + (mm - 58) * (10 / 22)));
}

// Use 80mm profile for >60mm paper, 58mm profile otherwise; override charWidth
function getProfile(mm: number): PrinterProfile {
  return mm > 60
    ? { ...GENERIC_PROFILE_80, charWidth: charWidth(mm) }
    : { ...GENERIC_PROFILE_58, charWidth: charWidth(mm) };
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
  customerName?: string | null;
  time: string;
  isTakeaway: boolean;
  items: Array<{
    name: string;
    quantity: number;
    unitOfMeasure: string;
    weight: number | null;
    modifiers: string[];
    notes: string | null;
  }>;
  paperWidth: PaperWidth;
}): string {
  const w = charWidth(params.paperWidth);
  const H = '='.repeat(w);
  const L = '-'.repeat(w);
  const lines: string[] = [
    H,
    center('Order Ticket', w),
    H,
    `KOT   : ${params.ticketNumber}`,
    `Order : ${params.orderNumber}`,
    `Round : ${params.roundNumber}`,
    `Table : ${params.tableLabel}`,
    `Time  : ${params.time}`,
    `Type  : ${params.isTakeaway ? 'Takeaway' : 'Dine-in'}`,
  ];
  if (params.customerName) lines.push(`Guest : ${params.customerName}`);
  lines.push(L);

  for (const item of params.items) {
    const isWeightBased = item.unitOfMeasure !== 'piece';
    const qtyLabel = isWeightBased
      ? `${item.quantity.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${item.unitOfMeasure}`
      : `${item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)}x`;
    lines.push(`${qtyLabel} ${item.name}`);
    if (item.weight != null) {
      lines.push(`   Berat: ${item.weight.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${item.unitOfMeasure}`);
    }
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
  customerName?: string | null;
  printedAt: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    modifiers: string[];
    weight: number | null;
    unitOfMeasure: string;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxRate: number;
  serviceCharge: number;
  serviceChargeRate: number;
  roundingAmount: number;
  total: number;
  payments?: Array<{ method: string; amount: number; changeAmount: number }>;
  paperWidth: PaperWidth;
}): string {
  const w = charWidth(params.paperWidth);
  const H = '='.repeat(w);
  const L = '-'.repeat(w);
  const rowFn = (label: string, value: string) =>
    `${pad(label, w - value.length)}${value}`;
  const isPaid = (params.payments?.length ?? 0) > 0;

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
    `Time  : ${formatReceiptDate(params.printedAt)}`,
  );
  if (params.customerName) lines.push(`Guest : ${params.customerName}`);
  lines.push(L);

  for (const item of params.items) {
    const prefix = `${item.quantity}x `;
    const priceStr = idr(item.total);
    const nameWidth = w - prefix.length - priceStr.length - 1;
    const nameLines = wrapText(item.name, nameWidth > 0 ? nameWidth : 1);
    lines.push(`${prefix}${pad(nameLines[0], nameWidth)} ${priceStr}`);
    for (let i = 1; i < nameLines.length; i++) lines.push(nameLines[i]);
    for (const mod of item.modifiers) lines.push(`   ${mod}`);
    if (item.weight) {
      const pricePerUnit = Math.round(item.unitPrice / item.weight);
      const weightDisplay = item.weight.toLocaleString('id-ID', { maximumFractionDigits: 3 });
      lines.push(`   ${idr(pricePerUnit)}/${item.unitOfMeasure} x ${weightDisplay} ${item.unitOfMeasure}`);
    }
  }

  lines.push(L, rowFn('Subtotal', idr(params.subtotal)));
  if (params.discountAmount > 0)    lines.push(rowFn('Diskon',                            `-${idr(params.discountAmount)}`));
  if (params.taxAmount > 0)         lines.push(rowFn(`Pajak (${params.taxRate}%)`,          idr(params.taxAmount)));
  if (params.serviceCharge > 0)     lines.push(rowFn(`Servis (${params.serviceChargeRate}%)`, idr(params.serviceCharge)));
  if (params.roundingAmount !== 0)  lines.push(rowFn('Pembulatan',                          idr(params.roundingAmount)));

  lines.push(H, rowFn('TOTAL', idr(params.total)), H);

  if (params.payments && params.payments.length > 0) {
    lines.push(L);
    for (const p of params.payments) {
      lines.push(rowFn(`Bayar (${p.method})`, idr(p.amount)));
      if (p.changeAmount > 0) lines.push(rowFn('Kembalian', idr(p.changeAmount)));
    }
    lines.push(L);
  }

  lines.push(H, center(isPaid ? 'LUNAS' : 'BELUM BAYAR', w), H);
  lines.push('', center('Terima kasih! 🙏', w), center('Sampai jumpa kembali', w), H);
  return lines.join('\n');
}

// ── Byte builders ─────────────────────────────────────────────────────────────
// These produce the ESC/POS Uint8Array that is actually sent to the printer.

function buildKOTBytes(params: Parameters<typeof formatKOT>[0]): Uint8Array {
  const profile = getProfile(params.paperWidth);
  const els: ReceiptElement[] = [
    header(),
    text('Order Ticket', { align: 'center', bold: true }),
    header(),
    text(`KOT   : ${params.ticketNumber}`),
    text(`Order : ${params.orderNumber}`),
    text(`Round : ${params.roundNumber}`),
    text(`Table : ${params.tableLabel}`),
    text(`Time  : ${params.time}`),
    text(`Type  : ${params.isTakeaway ? 'Takeaway' : 'Dine-in'}`),
  ];
  if (params.customerName) els.push(text(`Guest : ${params.customerName}`));
  els.push(divider());

  for (const item of params.items) {
    const isWeightBased = item.unitOfMeasure !== 'piece';
    const qtyLabel = isWeightBased
      ? `${item.quantity.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${item.unitOfMeasure}`
      : `${item.quantity % 1 === 0 ? item.quantity.toFixed(0) : item.quantity.toFixed(2)}x`;
    els.push(text(`${qtyLabel} ${item.name}`, { bold: true, size: { width: 1, height: 2 } }));
    if (item.weight != null) {
      els.push(text(`   Berat: ${item.weight.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${item.unitOfMeasure}`));
    }
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
  const isPaid = (params.payments?.length ?? 0) > 0;
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
    text(`Time  : ${formatReceiptDate(params.printedAt)}`),
  );
  if (params.customerName) els.push(text(`Guest : ${params.customerName}`));
  els.push(divider());

  for (const item of params.items) {
    els.push(
      columns(
        [
          { text: `${item.quantity}x ${item.name}`, width: 0.65, overflow: 'wrap' },
          { text: idr(item.total), width: 0.35, align: 'right' },
        ],
        { bold: true },
      ),
    );
    for (const mod of item.modifiers) {
      els.push(text(`   ${mod}`));
    }
    if (item.weight) {
      const pricePerUnit = Math.round(item.unitPrice / item.weight);
      const weightDisplay = item.weight.toLocaleString('id-ID', { maximumFractionDigits: 3 });
      els.push(text(`   ${idr(pricePerUnit)}/${item.unitOfMeasure} x ${weightDisplay} ${item.unitOfMeasure}`));
    }
  }

  els.push(divider(), row('Subtotal', idr(params.subtotal)));
  if (params.discountAmount > 0)    els.push(row('Diskon',                              `-${idr(params.discountAmount)}`));
  if (params.taxAmount > 0)         els.push(row(`Pajak (${params.taxRate}%)`,            idr(params.taxAmount)));
  if (params.serviceCharge > 0)     els.push(row(`Servis (${params.serviceChargeRate}%)`, idr(params.serviceCharge)));
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
    header(),
    text(isPaid ? 'LUNAS' : 'BELUM BAYAR', { align: 'center', bold: true, size: { width: 1, height: 2 } }),
    header(),
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
  params: Omit<Parameters<typeof formatKOT>[0], 'paperWidth'>,
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'KOT print skipped — no printer configured', { type }, 'warning');
    return;
  }
  try {
    await new BluetoothTransport(cfg.address).send(
      buildKOTBytes({ ...params, paperWidth: cfg.paperWidth }),
    );
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
  params: Omit<Parameters<typeof formatBill>[0], 'paperWidth'>,
): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Bill print skipped — no printer configured', { type }, 'warning');
    return;
  }
  try {
    await new BluetoothTransport(cfg.address).send(
      buildBillBytes({ ...params, paperWidth: cfg.paperWidth }),
    );
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
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Print skipped — no printer configured', { type }, 'warning');
    console.warn(`[Printer] No ${type} printer configured — skipping print`);
    return;
  }
  try {
    const profile = getProfile(cfg.paperWidth);
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


export async function printTestPage(type: PrinterType): Promise<void> {
  const cfg = await getConfig(type);
  if (!cfg) {
    addBreadcrumb('print', 'Test print skipped — no printer configured', { type }, 'warning');
    return;
  }
  const profile = getProfile(cfg.paperWidth);
  const now = new Date().toLocaleString('id-ID');
  const bytes = receipt([
    header(),
    text('TEST PRINT', { align: 'center', bold: true, size: { width: 1, height: 2 } }),
    header(),
    row('Printer', type),
    row('Paper',   `${cfg.paperWidth}mm`),
    row('Time',    now),
    // ── Image ──────────────────────────────────────────────────────
    divider(),
    text('Image Test', { align: 'center', bold: true }),
    space(1),
    image(TEST_IMAGE_BITMAP),
    // ── QR Code ────────────────────────────────────────────────────
    divider(),
    text('QR Code Test', { align: 'center', bold: true }),
    space(1),
    qr('https://wikipedia.org', { size: 4, correction: 'M' }),
    // ── Barcode ────────────────────────────────────────────────────
    divider(),
    text('Barcode Test', { align: 'center', bold: true }),
    space(1),
    barcode('CODE128', 'POS-TEMPEST', { height: 60, hri: 'below' }),
    // ── Footer ─────────────────────────────────────────────────────
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
