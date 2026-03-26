import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { PaymentMethodType } from '@/constants/enums';
import { PAYMENT_METHOD_TYPE } from '@/constants/enums';
import type { PendingPayment } from '@/components/payment/SplitPayment';

export function useCheckoutPayment(orderTotal: number) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(PAYMENT_METHOD_TYPE.CASH);
  const [cashInput, setCashInput] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);

  const totalTendered = useMemo(
    () => pendingPayments.reduce((sum, p) => sum + p.amount, 0),
    [pendingPayments],
  );
  const remainingBalance = useMemo(
    () => Math.max(0, orderTotal - totalTendered),
    [orderTotal, totalTendered],
  );
  const changeAmount = useMemo(
    () => Math.max(0, totalTendered - orderTotal),
    [orderTotal, totalTendered],
  );
  const isCash = selectedMethod === PAYMENT_METHOD_TYPE.CASH;

  const onMethodChange = useCallback((method: PaymentMethodType) => {
    setSelectedMethod(method);
    setCashInput('');
    setReferenceInput('');
  }, []);

  const onCashExact = useCallback(() => {
    setCashInput((Math.ceil(remainingBalance / 100) * 100).toString());
  }, [remainingBalance]);

  const onAddPayment = useCallback(() => {
    const amount = isCash ? parseFloat(cashInput) || 0 : remainingBalance;
    if (amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    setPendingPayments(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        method: selectedMethod,
        amount,
        referenceNumber: referenceInput.trim() || null,
      },
    ]);
    setCashInput('');
    setReferenceInput('');
  }, [isCash, cashInput, remainingBalance, selectedMethod, referenceInput]);

  const onRemovePayment = useCallback((id: string) => {
    setPendingPayments(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    selectedMethod,
    cashInput,
    setCashInput,
    referenceInput,
    setReferenceInput,
    pendingPayments,
    totalTendered,
    remainingBalance,
    changeAmount,
    isCash,
    onMethodChange,
    onCashExact,
    onAddPayment,
    onRemovePayment,
  };
}

export type CheckoutPayment = ReturnType<typeof useCheckoutPayment>;
