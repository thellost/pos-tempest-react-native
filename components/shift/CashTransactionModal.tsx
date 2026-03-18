import type { CashTransactionReason, CashTransactionType } from '@/constants/enums';
import { CASH_TRANSACTION_REASON, CASH_TRANSACTION_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { Delete } from 'lucide-react-native';
import { formatIDR } from '@/utils/currency';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

interface CashTransactionModalProps {
  visible: boolean;
  availableCash: number;
  onClose: () => void;
  onSubmit: (type: CashTransactionType, reason: CashTransactionReason, amount: number, note?: string) => Promise<void>;
}

const REASON_LABELS: Record<CashTransactionReason, string> = {
  [CASH_TRANSACTION_REASON.OWNER_WITHDRAWAL]: 'Owner Withdrawal',
  [CASH_TRANSACTION_REASON.SUPPLY_PURCHASE]: 'Supply Purchase',
  [CASH_TRANSACTION_REASON.STAFF_ADVANCE]: 'Staff Advance',
  [CASH_TRANSACTION_REASON.PETTY_CASH]: 'Petty Cash',
  [CASH_TRANSACTION_REASON.TIP_OUT]: 'Tip Out',
  [CASH_TRANSACTION_REASON.CASH_DEPOSIT]: 'Cash Deposit',
  [CASH_TRANSACTION_REASON.CHANGE_REFILL]: 'Change Refill',
  [CASH_TRANSACTION_REASON.OTHER]: 'Other',
};

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export function CashTransactionModal({ visible, availableCash, onClose, onSubmit }: CashTransactionModalProps) {
  const [type, setType] = useState<CashTransactionType>(CASH_TRANSACTION_TYPE.CASH_OUT);
  const [reason, setReason] = useState<CashTransactionReason>(CASH_TRANSACTION_REASON.SUPPLY_PURCHASE);
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amount = useMemo(() => Number(amountInput || '0'), [amountInput]);

  const canSubmit = useMemo(() => {
    if (amount <= 0) return false;
    if (type === CASH_TRANSACTION_TYPE.CASH_OUT && amount > availableCash) return false;
    return true;
  }, [amount, availableCash, type]);

  function applyKey(key: string) {
    if (key === 'C') {
      setAmountInput('');
      return;
    }

    if (key === '⌫') {
      setAmountInput(amountInput.slice(0, -1));
      return;
    }

    if (amountInput.length >= 9) return;

    if (amountInput === '0') {
      setAmountInput(key);
      return;
    }

    setAmountInput(`${amountInput}${key}`);
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;

    try {
      setSubmitting(true);
      setError('');
      await onSubmit(type, reason, amount, note.trim() || undefined);
      setAmountInput('');
      setNote('');
      setError('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record transaction');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setAmountInput('');
    setNote('');
    setError('');
    onClose();
  }

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}>
      <View
        className="overflow-hidden rounded-2xl border border-border bg-surface-card"
        style={{ width: 520, maxHeight: '85%' }}
      >
        {/* Header */}
        <View className="border-b border-border p-5">
          <Text className="text-pos-xl font-bold text-pos-text">Cash Transaction</Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            Available in drawer: {formatIDR(availableCash)}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Type Toggle */}
          <Text className="text-pos-sm font-semibold text-pos-text">Transaction Type</Text>
          <View className="mt-2 flex-row gap-3">
            <Pressable
              className={`flex-1 rounded-xl border p-3 ${
                type === CASH_TRANSACTION_TYPE.CASH_OUT
                  ? 'border-pos-danger bg-pos-danger-muted'
                  : 'border-border bg-surface'
              }`}
              onPress={() => setType(CASH_TRANSACTION_TYPE.CASH_OUT)}>
              <Text
                className={`text-center text-pos-base font-semibold ${
                  type === CASH_TRANSACTION_TYPE.CASH_OUT ? 'text-pos-danger' : 'text-pos-text-muted'
                }`}>
                Cash Out
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 rounded-xl border p-3 ${
                type === CASH_TRANSACTION_TYPE.CASH_IN
                  ? 'border-pos-success bg-pos-success-muted'
                  : 'border-border bg-surface'
              }`}
              onPress={() => setType(CASH_TRANSACTION_TYPE.CASH_IN)}>
              <Text
                className={`text-center text-pos-base font-semibold ${
                  type === CASH_TRANSACTION_TYPE.CASH_IN ? 'text-pos-success' : 'text-pos-text-muted'
                }`}>
                Cash In
              </Text>
            </Pressable>
          </View>

          {/* Reason Selector */}
          <Text className="mt-5 text-pos-sm font-semibold text-pos-text">Reason</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {Object.entries(REASON_LABELS).map(([key, label]) => (
              <Pressable
                key={key}
                className={`rounded-xl border px-4 py-2 ${
                  reason === key ? 'border-accent bg-accent-muted' : 'border-border bg-surface'
                }`}
                onPress={() => setReason(key as CashTransactionReason)}>
                <Text
                  className={`text-pos-sm font-medium ${reason === key ? 'text-accent' : 'text-pos-text-muted'}`}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Amount Input */}
          <Text className="mt-5 text-pos-sm font-semibold text-pos-text">Amount</Text>
          <View className="mt-2 rounded-xl border border-border bg-surface px-4 py-3">
            <Text className="text-pos-2xl font-bold text-accent">{formatIDR(amount)}</Text>
          </View>

          {/* Validation Warning */}
          {type === CASH_TRANSACTION_TYPE.CASH_OUT && amount > availableCash && (
            <View className="mt-2 rounded-xl bg-pos-danger-muted p-3">
              <Text className="text-pos-sm text-pos-danger">
                Insufficient cash in drawer. Maximum: {formatIDR(availableCash)}
              </Text>
            </View>
          )}

          {/* Numpad */}
          <View className="mt-4 flex-row flex-wrap justify-between">
            {keypad.map((key) => (
              <Pressable
                key={key}
                className="mb-3 h-14 w-[31%] items-center justify-center rounded-xl border border-border bg-surface"
                disabled={submitting}
                onPress={() => applyKey(key)}>
                {key === '⌫'
                  ? <Delete size={20} color={ThemeColors.text.muted} />
                  : <Text className="text-pos-lg font-semibold text-pos-text">{key}</Text>
                }
              </Pressable>
            ))}
          </View>

          {/* Note Input */}
          <Text className="mt-4 text-pos-sm font-semibold text-pos-text">Note (Optional)</Text>
          <TextInput
            className="mt-2 min-h-[80px] rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
            placeholder="e.g., Bought ice from nearby store"
            placeholderTextColor={ThemeColors.text.faint}
            value={note}
            onChangeText={setNote}
            multiline
            editable={!submitting}
          />

          {error && (
            <View className="mt-3 rounded-xl bg-pos-danger-muted p-3">
              <Text className="text-pos-sm text-pos-danger">{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View className="border-t border-border p-4 flex-row gap-3">
          <Pressable
            className="flex-1 rounded-xl border border-border bg-surface p-4"
            disabled={submitting}
            onPress={handleClose}>
            <Text className="text-center text-pos-base font-semibold text-pos-text-muted">Cancel</Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-xl p-4 ${
              canSubmit
                ? type === CASH_TRANSACTION_TYPE.CASH_OUT
                  ? 'bg-pos-danger'
                  : 'bg-pos-success'
                : 'bg-surface-soft'
            }`}
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}>
            <Text
              className={`text-center text-pos-base font-semibold ${
                canSubmit ? 'text-white' : 'text-pos-text-muted'
              }`}>
              {submitting ? 'Processing...' : 'Record Transaction'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
