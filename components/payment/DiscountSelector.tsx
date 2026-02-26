import { memo, useCallback } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { DISCOUNT_TYPE } from '@/constants/enums';
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

/** Returns false if the order subtotal doesn't meet the minimum requirement */
function checkEligibility(discount: Discount, subtotal: number): boolean {
  return discount.min_order_amount === null || subtotal >= discount.min_order_amount;
}

/** Calculates the preview discount amount for display */
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

/**
 * Full-screen modal listing all active discounts.
 * Eligibility is checked against the current order subtotal in real time.
 * Ineligible discounts are shown but greyed out with a reason.
 */
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
  const handleRemove = useCallback(() => {
    onRemove();
    onClose();
  }, [onRemove, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Dimmed backdrop — tap to close */}
      <Pressable
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)' }}
        onPress={onClose}
      >
        {/* Card — stop propagation so tapping inside doesn't close */}
        <Pressable
          style={{
            width: 420,
            maxHeight: '78%',
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: '#1A1F2C',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.07)',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#F8FAFC' }}>
              🏷️  Select Discount
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>Close</Text>
            </Pressable>
          </View>

          {/* Body */}
          {isLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <ActivityIndicator color="#6366F1" />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Remove current discount */}
              {appliedDiscount && (
                <Pressable
                  onPress={handleRemove}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                    backgroundColor: pressed
                      ? 'rgba(239,68,68,0.12)'
                      : 'rgba(239,68,68,0.06)',
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>
                      ✕  Remove: {appliedDiscount.discount_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Currently applied: −{formatIDR(appliedDiscount.applied_amount)}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Empty state */}
              {discounts.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                  <Text style={{ fontSize: 14, color: '#64748B' }}>
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
                    style={({ pressed }) => ({
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                      opacity: eligible ? (pressed ? 0.7 : 1) : 0.45,
                      backgroundColor: isApplied
                        ? 'rgba(99,102,241,0.12)'
                        : 'transparent',
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      {/* Info column */}
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#F8FAFC' }}>
                            {discount.name}
                          </Text>
                          {isApplied && (
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 20,
                                backgroundColor: 'rgba(99,102,241,0.3)',
                              }}
                            >
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#818CF8', letterSpacing: 0.5 }}>
                                APPLIED
                              </Text>
                            </View>
                          )}
                        </View>

                        {discount.description ? (
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            {discount.description}
                          </Text>
                        ) : null}

                        {discount.min_order_amount ? (
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                            Min order: {formatIDR(discount.min_order_amount)}
                          </Text>
                        ) : null}

                        {!eligible && (
                          <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>
                            Not eligible — minimum not met
                          </Text>
                        )}
                      </View>

                      {/* Amount column */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>
                          −{formatIDR(previewAmount)}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
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
    </Modal>
  );
});
