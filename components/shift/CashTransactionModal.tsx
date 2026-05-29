import { CASH_TRANSACTION_TYPE } from '@/constants/enums';
import type { CashTransactionType } from '@/constants/enums';
import { Config } from '@/constants/config';
import { ThemeColors } from '@/constants/theme';
import { Delete } from 'lucide-react-native';
import { formatIDR } from '@/utils/currency';
import type { CashReasonOption } from '@/hooks/use-cash-reasons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, SelectButton, ShakeField, type ShakeFieldRef } from '@/components/ui';

interface CashTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  cashInEnabled: boolean;
  reasons: CashReasonOption[];
  onSubmit: (type: CashTransactionType, reason: string, amount: number, note?: string) => Promise<void>;
}

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

function getVisibleReasons(reasons: CashReasonOption[], type: CashTransactionType): CashReasonOption[] {
  return reasons.filter((r) => !r.type || r.type === type);
}

export function CashTransactionModal({ visible, cashInEnabled, reasons, onClose, onSubmit }: CashTransactionModalProps) {
  const [type, setType] = useState<CashTransactionType>(CASH_TRANSACTION_TYPE.CASH_OUT);
  const [reason, setReason] = useState<string>('');
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amountRef = useRef<ShakeFieldRef>(null);

  const amount = useMemo(() => Number(amountInput || '0'), [amountInput]);

  const canSubmit = useMemo(() => amount > 0, [amount]);

  const isCashIn = type === CASH_TRANSACTION_TYPE.CASH_IN;

  const typeReasons = useMemo(() => getVisibleReasons(reasons, type), [reasons, type]);

  useEffect(() => {
    if (typeReasons.length > 0 && !typeReasons.find((r) => r.key === reason)) {
      setReason(typeReasons[0].key);
    }
  }, [typeReasons, reason]);

  function handleTypeChange(newType: CashTransactionType) {
    setType(newType);
  }

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
    <View className="absolute inset-0 z-50 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
      <View
        className="overflow-hidden rounded-2xl border border-border bg-surface-card"
        style={{ width: 520, maxWidth: '95%', maxHeight: '85%' }}
      >
        {/* Header */}
        <View className="border-b border-border p-5">
          <Text className="text-pos-xl font-bold text-pos-text">
            {isCashIn ? 'Record Cash In' : 'Record Cash Out'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Type Toggle */}
          <Text className="text-pos-sm font-semibold text-pos-text">Transaction Type</Text>
          <View className="mt-2 flex-row gap-3">
            <SelectButton
              selected={type === CASH_TRANSACTION_TYPE.CASH_OUT}
              selectedClassName="border-pos-danger bg-pos-danger-muted"
              unselectedClassName="border-border bg-surface"
              className="flex-1 rounded-xl p-3"
              disabled={submitting}
              onPress={() => handleTypeChange(CASH_TRANSACTION_TYPE.CASH_OUT)}>
              <Text
                className={`text-center text-pos-base font-semibold ${
                  type === CASH_TRANSACTION_TYPE.CASH_OUT ? 'text-pos-danger' : 'text-pos-text-muted'
                }`}>
                Cash Out
              </Text>
            </SelectButton>
            {cashInEnabled && (
              <SelectButton
                selected={type === CASH_TRANSACTION_TYPE.CASH_IN}
                selectedClassName="border-pos-success bg-pos-success-muted"
                unselectedClassName="border-border bg-surface"
                className="flex-1 rounded-xl p-3"
                disabled={submitting}
                onPress={() => handleTypeChange(CASH_TRANSACTION_TYPE.CASH_IN)}>
                <Text
                  className={`text-center text-pos-base font-semibold ${
                    type === CASH_TRANSACTION_TYPE.CASH_IN ? 'text-pos-success' : 'text-pos-text-muted'
                  }`}>
                  Cash In
                </Text>
              </SelectButton>
            )}
          </View>

          {/* Reason Selector */}
          <Text className="mt-5 text-pos-sm font-semibold text-pos-text">Reason</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {typeReasons.map((r) => (
              <SelectButton
                key={r.key}
                selected={reason === r.key}
                selectedClassName="border-accent bg-accent-muted"
                unselectedClassName="border-border bg-surface"
                className="rounded-xl px-4 py-2"
                disabled={submitting}
                onPress={() => setReason(r.key)}>
                <Text
                  className={`text-pos-sm font-medium ${reason === r.key ? 'text-accent' : 'text-pos-text-muted'}`}>
                  {r.label}
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
              canSubmit
                ? isCashIn ? 'bg-pos-success' : 'bg-pos-danger'
                : 'bg-surface-soft'
            }`}
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}>
            <Text
              className={`text-center text-pos-base font-semibold ${
                canSubmit ? 'text-white' : 'text-pos-text-muted'
              }`}>
              {submitting ? 'Processing...' : isCashIn ? 'Record Cash In' : 'Record Cash Out'}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
