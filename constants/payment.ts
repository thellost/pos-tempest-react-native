import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_TYPE } from '@/constants/enums';
import { PaymentColors } from '@/constants/theme';

export interface PaymentMethodConfig {
  method: PaymentMethodType;
  label: string;
  emoji: string;
  color: string;
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { method: PAYMENT_METHOD_TYPE.CASH,          label: 'Cash',     emoji: '💵', color: PaymentColors.cash },
  { method: PAYMENT_METHOD_TYPE.QRIS,          label: 'QRIS',     emoji: '📱', color: PaymentColors.qris },
  { method: PAYMENT_METHOD_TYPE.DEBIT_CARD,    label: 'Debit',    emoji: '💳', color: PaymentColors.debit },
  { method: PAYMENT_METHOD_TYPE.CREDIT_CARD,   label: 'Credit',   emoji: '💳', color: PaymentColors.credit },
  { method: PAYMENT_METHOD_TYPE.EWALLET,       label: 'E-Wallet', emoji: '👛', color: PaymentColors.eWallet },
  { method: PAYMENT_METHOD_TYPE.BANK_TRANSFER, label: 'Transfer', emoji: '🏦', color: PaymentColors.bankTransfer },
];

export const PAYMENT_METHOD_LABEL: Record<string, string> =
  Object.fromEntries(PAYMENT_METHODS.map((p) => [p.method, p.label]));

export const PAYMENT_METHOD_COLOR: Record<string, string> =
  Object.fromEntries(PAYMENT_METHODS.map((p) => [p.method, p.color]));
