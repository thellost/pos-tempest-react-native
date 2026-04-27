import type { CashTransactionReason } from '@/constants/enums';
import { CASH_TRANSACTION_REASON } from '@/constants/enums';
import { Config } from '@/constants/config';
import { ThemeColors } from '@/constants/theme';
import { Delete } from 'lucide-react-native';
import { formatIDR } from '@/utils/currency';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, SelectButton, ShakeField, type ShakeFieldRef } from '@/components/ui';

interface CashTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: CashTransactionReason, amount: number, note?: string) => Promise<void>;
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

export function CashTransactionModal({ visible, onClose, onSubmit }: CashTransactionModalProps) {
  const [reason, setReason] = useState<CashTransactionReason>(CASH_TRANSACTION_REASON.SUPPLY_PURCHASE);
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amountRef = useRef<ShakeFieldRef>(null);

  const amount = useMemo(() => Number(amountInput || '0'), [amountInput]);

  const canSubmit = useMemo(() => amount > 0, [amount]);

  function applyKey(key: string) {
    if (key === 'C') {
      setAmountInput('');
      return;
    }

    if (key === '⌫') {
      setAmountInput(amountInput.slice(0, -1));
      return;
    }

    if (amountInput.length >= Config.CASH_AMOUNT_MAX_INPUT_LENGTH) return;

    if (amountInput === '0') {
      setAmountInput(key);
      return;
    }

    setAmountInput(`${amountInput}${key}`);
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!canSubmit) {
      amountRef.current?.shake();
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await onSubmit(reason, amount, note.trim() || undefined);
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
    <View className="absolute inset-0 z-50 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
      <View
        className="overflow-hidden rounded-2xl border border-border bg-surface-card"
        style={{ width: 520, maxWidth: '95%', maxHeight: '85%' }}
      >
        {/* Header */}
        <View className="border-b border-border p-5">
          <Text className="text-pos-xl font-bold text-pos-text">Record Cash Out</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Reason Selector */}
          <Text className="mt-5 text-pos-sm font-semibold text-pos-text">Reason</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {Object.entries(REASON_LABELS).map(([key, label]) => (
              <SelectButton
                key={key}
                selected={reason === key}
                selectedClassName="border-accent bg-accent-muted"
                unselectedClassName="border-border bg-surface"
                className="rounded-xl px-4 py-2"
                onPress={() => setReason(key as CashTransactionReason)}>
                <Text
                  className={`text-pos-sm font-medium ${reason === key ? 'text-accent' : 'text-pos-text-muted'}`}>
                  {label}
                </Text>
              </SelectButton>
            ))}
          </View>

          {/* Amount Input */}
          <Text className="mt-5 text-pos-sm font-semibold text-pos-text">Amount</Text>
          <ShakeField ref={amountRef} className="mt-2 rounded-xl border border-border bg-surface px-4 py-3">
            <Text className="text-pos-2xl font-bold text-accent">{formatIDR(amount)}</Text>
          </ShakeField>

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
          <Button
            className="flex-1 items-center justify-center rounded-xl border border-border bg-surface p-4"
            disabled={submitting}
            onPress={handleClose}>
            <Text className="text-center text-pos-base font-semibold text-pos-text-muted">Cancel</Text>
          </Button>
          <Button
            className={`flex-1 items-center justify-center rounded-xl p-4 ${
              canSubmit ? 'bg-pos-danger' : 'bg-surface-soft'
            }`}
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}>
            <Text
              className={`text-center text-pos-base font-semibold ${
                canSubmit ? 'text-white' : 'text-pos-text-muted'
              }`}>
              {submitting ? 'Processing...' : 'Record Cash Out'}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
