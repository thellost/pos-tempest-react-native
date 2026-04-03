import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { toInt } from '@/utils/coerce';
import type { Discount, OrderDiscount } from '@/db/models';
import {
  applyOrderDiscount,
  getActiveDiscounts,
  getOrderDiscount,
  removeOrderDiscount,
} from '@/services/payment.service';

export function useOrderDiscount(orderId: string, userId?: number) {
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<OrderDiscount | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  // 'idle' = not yet fetched, 'loading' = in-flight, 'loaded' = cached
  const [discountStatus, setDiscountStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');

  useEffect(() => {
    getOrderDiscount(orderId)
      .then(setAppliedDiscount)
      .catch(err => console.error('[Checkout] Error loading discount:', err));
  }, [orderId]);

  const onOpenPicker = useCallback(async () => {
    setShowDiscountPicker(true);
    if (discountStatus !== 'idle') return;
    try {
      setDiscountStatus('loading');
      const discounts = await getActiveDiscounts();
      setAvailableDiscounts(discounts);
      setDiscountStatus('loaded');
    } catch (err) {
      console.error('[Checkout] Error loading discounts:', err);
      setDiscountStatus('idle');
    }
  }, [discountStatus]);

  const onApply = useCallback(
    async (discount: Discount) => {
      if (!userId) return;
      try {
        await applyOrderDiscount(orderId, toInt(discount.id), userId);
        const updated = await getOrderDiscount(orderId);
        setAppliedDiscount(updated);
        setShowDiscountPicker(false);
      } catch (err) {
        Alert.alert(
          'Discount Error',
          err instanceof Error ? err.message : 'Failed to apply discount',
        );
      }
    },
    [orderId, userId],
  );

  const onRemove = useCallback(async () => {
    try {
      await removeOrderDiscount(orderId);
      setAppliedDiscount(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove discount');
    }
  }, [orderId]);

  const onClose = useCallback(() => setShowDiscountPicker(false), []);

  return {
    showDiscountPicker,
    appliedDiscount,
    availableDiscounts,
    isLoading: discountStatus === 'loading',
    onOpenPicker,
    onApply,
    onRemove,
    onClose,
  };
}

export type OrderDiscountState = ReturnType<typeof useOrderDiscount>;
