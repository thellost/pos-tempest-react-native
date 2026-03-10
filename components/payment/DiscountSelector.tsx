import { memo, useCallback } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { DISCOUNT_TYPE } from '@/constants/enums';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { Discount, OrderDiscount } from '@/db/models';
import { formatIDR } from '@/utils/currency';

interface DiscountSelectorProps {
  visible: boolean;
  discounts: Discount[];
  appliedDiscount: OrderDiscount | null;
  orderSubtotal: number;
  onApply: (discount: Discount) => void;
  onRemove: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

function checkEligibility(discount: Discount, subtotal: number): boolean {
  return discount.min_order_amount === null || subtotal >= discount.min_order_amount;
}

function previewDiscountAmount(discount: Discount, subtotal: number): number {
  if (!checkEligibility(discount, subtotal)) return 0;
  let amount =
    discount.discount_type === DISCOUNT_TYPE.PERCENTAGE
      ? subtotal * (discount.value / 100)
      : discount.value;
  if (discount.max_discount_amount !== null) {
    amount = Math.min(amount, discount.max_discount_amount);
  }
  return Math.min(amount, subtotal);
}

export const DiscountSelector = memo(function DiscountSelector({
  visible,
  discounts,
  appliedDiscount,
  orderSubtotal,
  onApply,
  onRemove,
  onClose,
  isLoading = false,
}: DiscountSelectorProps) {
  const { themeVars } = useAppTheme();
  const handleRemove = useCallback(() => { onRemove(); onClose(); }, [onRemove, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* themeVars re-applied here because Modal renders outside the CSS variable tree */}
      <View style={[{ flex: 1 }, themeVars]}>
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
        onPress={onClose}
      >
        <Pressable
          className="overflow-hidden rounded-xl border border-border bg-surface-card"
          style={{ width: 420, maxHeight: '78%' }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
            <Text className="text-pos-base font-bold text-pos-text">
              🏷️  Select Discount
            </Text>
            <Pressable
              onPress={onClose}
              className="rounded border border-border bg-surface-raised px-3 py-1.5"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-pos-xs font-semibold text-pos-text-muted">Close</Text>
            </Pressable>
          </View>

          {/* Body */}
          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator color={Brand.primary} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Remove current discount */}
              {appliedDiscount && (
                <Pressable
                  onPress={handleRemove}
                  className="border-b border-border bg-pos-danger-muted px-5 py-3.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-pos-sm font-bold text-pos-danger">
                    ✕  Remove: {appliedDiscount.discount_name}
                  </Text>
                  <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                    Currently applied: −{formatIDR(appliedDiscount.applied_amount)}
                  </Text>
                </Pressable>
              )}

              {/* Empty state */}
              {discounts.length === 0 && (
                <View className="items-center py-12">
                  <Text className="text-pos-sm text-pos-text-muted">
                    No active discounts available
                  </Text>
                </View>
              )}

              {/* Discount rows */}
              {discounts.map((discount) => {
                const eligible = checkEligibility(discount, orderSubtotal);
                const previewAmount = previewDiscountAmount(discount, orderSubtotal);
                const isApplied = appliedDiscount?.discount_id === discount.id;

                return (
                  <Pressable
                    key={discount.id}
                    onPress={() => eligible && onApply(discount)}
                    className={`border-b border-border px-5 py-3.5 ${
                      isApplied ? 'bg-accent-muted' : ''
                    }`}
                    style={({ pressed }) => ({
                      opacity: eligible ? (pressed ? 0.7 : 1) : 0.45,
                    })}
                  >
                    <View className="flex-row items-start">
                      <View className="mr-3 flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-pos-sm font-bold text-pos-text">
                            {discount.name}
                          </Text>
                          {isApplied && (
                            <View className="rounded-full bg-accent-muted px-2 py-0.5">
                              <Text className="text-[9px] font-extrabold tracking-wide text-accent">
                                APPLIED
                              </Text>
                            </View>
                          )}
                        </View>

                        {discount.description ? (
                          <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                            {discount.description}
                          </Text>
                        ) : null}

                        {discount.min_order_amount ? (
                          <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                            Min order: {formatIDR(discount.min_order_amount)}
                          </Text>
                        ) : null}

                        {!eligible && (
                          <Text className="mt-0.5 text-pos-xs text-pos-danger">
                            Not eligible — minimum not met
                          </Text>
                        )}
                      </View>

                      <View className="items-end">
                        <Text className="text-pos-sm font-extrabold text-pos-success">
                          −{formatIDR(previewAmount)}
                        </Text>
                        <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                          {discount.discount_type === DISCOUNT_TYPE.PERCENTAGE
                            ? `${discount.value}%`
                            : formatIDR(discount.value)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
      </View>
    </Modal>
  );
});
