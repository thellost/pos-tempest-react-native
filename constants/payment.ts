import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_TYPE } from '@/constants/enums';
import { PaymentColors } from '@/constants/theme';
import { Banknote, Building2, CreditCard, QrCode, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface PaymentMethodConfig {
  method: PaymentMethodType;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { method: PAYMENT_METHOD_TYPE.CASH,          label: 'Cash',     icon: Banknote,   color: PaymentColors.cash },
  { method: PAYMENT_METHOD_TYPE.QRIS,          label: 'QRIS',     icon: QrCode,     color: PaymentColors.qris },
  { method: PAYMENT_METHOD_TYPE.DEBIT_CARD,    label: 'Debit',    icon: CreditCard, color: PaymentColors.debit },
  { method: PAYMENT_METHOD_TYPE.CREDIT_CARD,   label: 'Credit',   icon: CreditCard, color: PaymentColors.credit },
  { method: PAYMENT_METHOD_TYPE.EWALLET,       label: 'E-Wallet', icon: Wallet,     color: PaymentColors.eWallet },
  { method: PAYMENT_METHOD_TYPE.BANK_TRANSFER, label: 'Transfer', icon: Building2,  color: PaymentColors.bankTransfer },
];

export const PAYMENT_METHOD_LABEL: Record<string, string> =
  Object.fromEntries(PAYMENT_METHODS.map((p) => [p.method, p.label]));

export const PAYMENT_METHOD_COLOR: Record<string, string> =
  Object.fromEntries(PAYMENT_METHODS.map((p) => [p.method, p.color]));
