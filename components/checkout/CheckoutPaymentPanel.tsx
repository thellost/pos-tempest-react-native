import type React from 'react';
import { Receipt, Tag, X } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, IconButton, PrimaryButton } from '@/components/ui';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { CashPayment } from '@/components/payment/CashPayment';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { SplitPayment } from '@/components/payment/SplitPayment';
import { PERMISSION } from '@/constants/permissions';
import { ThemeColors } from '@/constants/theme';
import type { CheckoutPayment } from '@/hooks/use-checkout-payment';
import type { OrderDiscountState } from '@/hooks/use-order-discount';
import { formatIDR } from '@/utils/currency';

interface Props {
  payment: CheckoutPayment;
  discount: Pick<OrderDiscountState, 'appliedDiscount' | 'onOpenPicker' | 'onRemove'>;
  orderTotal: number;
  isProcessing: boolean;
  canComplete: boolean;
  onComplete: () => void;
}

export function CheckoutPaymentPanel({
  payment,
  discount,
  orderTotal,
  isProcessing,
  canComplete,
  onComplete,
}: Props) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard>
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold tracking-widest text-pos-text-faint">
              DISCOUNT
            </Text>
            <Button
              onPress={discount.onOpenPicker}
              className="rounded border border-accent/30 bg-accent/10 px-2.5 py-1"
            >
              <Text className="text-[11px] font-bold text-accent-hover">
                {discount.appliedDiscount ? 'Change' : '+ Apply'}
              </Text>
            </Button>
          </View>
          {discount.appliedDiscount ? (
            <View className="flex-row items-center gap-2 rounded-lg border border-pos-success/30 bg-pos-success/10 p-2.5">
              <Tag size={16} color={ThemeColors.success.DEFAULT} />
              <View className="flex-1">
                <Text className="text-pos-xs font-bold text-pos-success">
                  {discount.appliedDiscount.discount_name}
                </Text>
                <Text className="text-pos-xs text-pos-text-faint">
                  −{formatIDR(discount.appliedDiscount.applied_amount)}
                </Text>
              </View>
              <IconButton
                onPress={discount.onRemove}
                size="sm"
                hitSlop={8}
                className="bg-transparent"
              >
                <X size={14} color={ThemeColors.danger.DEFAULT} />
              </IconButton>
            </View>
          ) : (
            <Text className="text-pos-xs italic text-pos-text-muted">No discount applied</Text>
          )}
        </SectionCard>

        <SectionCard>
          <Text className="mb-2.5 text-[11px] font-bold tracking-widest text-pos-text-faint">
            PAYMENT METHOD
          </Text>
          <PaymentMethodSelector
            selected={payment.selectedMethod}
            onSelect={payment.onMethodChange}
          />
        </SectionCard>

        <SectionCard>
          <Text className="mb-2.5 text-[11px] font-bold tracking-widest text-pos-text-faint">
            {payment.isCash ? 'CASH AMOUNT' : 'PAYMENT DETAILS'}
          </Text>
          {payment.isCash ? (
            <CashPayment
              value={payment.cashInput}
              onChange={payment.setCashInput}
              remainingBalance={payment.remainingBalance}
              onExact={payment.onCashExact}
            />
          ) : (
            <NonCashInput
              remainingBalance={payment.remainingBalance}
              referenceInput={payment.referenceInput}
              onReferenceChange={payment.setReferenceInput}
            />
          )}
          <PrimaryButton
            onPress={payment.onAddPayment}
            disabled={payment.isCash && !payment.cashInput}
            className="mt-3 h-11 rounded-lg"
          >
            <Text className="text-pos-sm font-extrabold text-white">+ Add Payment</Text>
          </PrimaryButton>
        </SectionCard>

        {payment.pendingPayments.length > 0 && (
          <SectionCard>
            <Text className="mb-2.5 text-[11px] font-bold tracking-widest text-pos-text-faint">
              PAYMENTS ADDED
            </Text>
            <SplitPayment
              payments={payment.pendingPayments}
              orderTotal={orderTotal}
              onRemove={payment.onRemovePayment}
            />
          </SectionCard>
        )}
      </ScrollView>

      <PermissionGate
        permission={PERMISSION.PROCESS_PAYMENT}
        fallback={
          <View className="border-t border-border bg-surface-card px-4 py-4">
            <Text className="text-center text-pos-sm text-pos-warning">
              Only cashiers and above can process payments.
            </Text>
          </View>
        }
      >
        <View className="border-t border-border bg-surface-card px-4 py-3" style={{ gap: 8 }}>
          {payment.pendingPayments.length > 0 && (
            <View className="flex-row items-center justify-between">
              {payment.remainingBalance > 0 ? (
                <>
                  <Text className="text-pos-sm text-pos-text-muted">Remaining</Text>
                  <Text className="text-pos-base font-extrabold text-pos-warning">
                    {formatIDR(payment.remainingBalance)}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-pos-sm text-pos-text-muted">Change to give</Text>
                  <Text className="text-pos-base font-extrabold text-pos-success">
                    {formatIDR(payment.changeAmount)}
                  </Text>
                </>
              )}
            </View>
          )}

          <Button
            onPress={onComplete}
            disabled={!canComplete}
            className={`h-[52px] flex-row items-center justify-center gap-2 rounded-xl ${
              canComplete ? 'bg-accent' : 'bg-accent/40'
            }`}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text
                  className={`font-black ${canComplete ? 'text-pos-text-strong' : 'text-pos-text-faint'}`}
                  style={{ fontSize: 15, letterSpacing: 0.3 }}
                >
                  Complete &amp; Print Receipt
                </Text>
                <Receipt size={18} color={ThemeColors.text.primary} />
              </>
            )}
          </Button>
        </View>
      </PermissionGate>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-border bg-surface-card p-3">{children}</View>
  );
}

function NonCashInput({
  remainingBalance,
  referenceInput,
  onReferenceChange,
}: {
  remainingBalance: number;
  referenceInput: string;
  onReferenceChange: (value: string) => void;
}) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between rounded-lg border border-accent/25 bg-accent/10 p-3">
        <Text className="text-pos-xs text-pos-text-muted">Amount (auto-filled)</Text>
        <Text className="text-pos-lg font-extrabold text-accent-hover">
          {formatIDR(remainingBalance)}
        </Text>
      </View>
      <View>
        <Text className="mb-1 text-pos-xs text-pos-text-faint">Reference No. (optional)</Text>
        <TextInput
          value={referenceInput}
          onChangeText={onReferenceChange}
          placeholder="e.g. QRIS txn ID, slip number…"
          placeholderTextColor="#94A3B8"
          className="h-[42px] rounded-lg border border-border bg-surface-raised px-3 text-pos-sm text-pos-text"
        />
      </View>
    </View>
  );
}
