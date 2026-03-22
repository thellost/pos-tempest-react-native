import AsyncStorage from '@react-native-async-storage/async-storage';

import { addBreadcrumb } from '@/lib/sentry';

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

// ── ESC/POS formatters ────────────────────────────────────────────────────────
// These produce the raw text that would be sent to a thermal printer.
// When the Bluetooth library is wired in, pass the output of these functions
// to the printer's write() method.

function charWidth(paperWidth: PaperWidth): number {
  return paperWidth === '80mm' ? 42 : 32;
}

function pad(text: string, total: number, right = false): string {
  if (right) return text.slice(0, total).padStart(total);
  return text.slice(0, total).padEnd(total);
}

function center(text: string, w: number): string {
  const spaces = Math.max(0, Math.floor((w - text.length) / 2));
  return ' '.repeat(spaces) + text;
}

/**
 * Formats a KOT (Kitchen Order Ticket) for ESC/POS printing.
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
 * Formats a customer-facing bill or receipt for ESC/POS printing.
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
  const idr = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
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

  lines.push(
    L,
    row('Subtotal', idr(params.subtotal)),
  );
  if (params.discountAmount > 0) lines.push(row('Diskon', `-${idr(params.discountAmount)}`));
  if (params.taxAmount > 0) lines.push(row('Pajak (11%)', idr(params.taxAmount)));
  if (params.serviceCharge > 0) lines.push(row('Servis', idr(params.serviceCharge)));
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

// ── Simulated print ───────────────────────────────────────────────────────────

/**
 * Sends formatted ESC/POS data to the configured printer.
 *
 * Currently SIMULATED — replace the body with a Bluetooth library call when
 * hardware is available:
 *   e.g. await RNBluetoothEscposPrinter.printText(data, {});
 */
export async function sendToPrinter(
  type: PrinterType,
  data: string,
): Promise<void> {
  const settings = await getPrinterSettings();
  const cfg = type === 'kitchen' ? settings.kitchenPrinter : settings.cashierPrinter;

  if (!cfg) {
    addBreadcrumb('print', 'Print skipped — no printer configured', { type }, 'warning');
    console.warn(`[Printer] No ${type} printer configured — skipping print`);
    return;
  }

  addBreadcrumb('print', 'Print started', { type, address: cfg.address });
  // TODO: replace with Bluetooth library call
  // e.g.: await RNBluetoothEscposPrinter.printText(data, {});
  console.log(
    `[Printer] Simulating ${type} print to ${cfg.address}:\n${data}`,
  );
}

/**
 * Opens the cash drawer via an ESC/POS kick command.
 * Requires a paired cashier printer.
 */
export async function openCashDrawer(): Promise<void> {
  // TODO: replace with Bluetooth library command
  // e.g.: await RNBluetoothEscposPrinter.openDrawer(0, 250, 250);
  console.log('[Printer] Cash drawer open command (simulated)');
}
