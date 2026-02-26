import { useQuery } from '@powersync/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CashPayment } from '@/components/payment/CashPayment';
import { DiscountSelector } from '@/components/payment/DiscountSelector';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import type { PendingPayment } from '@/components/payment/SplitPayment';
import { SplitPayment } from '@/components/payment/SplitPayment';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import type { PaymentMethodType } from '@/constants/enums';
import { ORDER_STATUS, PAYMENT_METHOD_TYPE } from '@/constants/enums';
import type { Discount, Order, OrderDiscount, OrderItem, OrderItemModifier } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { useShift } from '@/hooks/use-shift';
import {
  applyOrderDiscount,
  completeOrder,
  getActiveDiscounts,
  getOrderDiscount,
  processPayment,
  removeOrderDiscount,
} from '@/services/payment.service';
import type { BillData } from '@/services/receipt.service';
import { getBillData } from '@/services/receipt.service';
import { formatIDR } from '@/utils/currency';

// ── Types ────────────────────────────────────────────────────────────────────

type OrderRow = Order & {
  table_number: string | null;
  branch_name: string | null;
};

interface OrderItemRow extends OrderItem {
  modifiers: OrderItemModifier[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

// ── Root (validates params) ───────────────────────────────────────────────────

export default function CheckoutScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  if (!orderId || Array.isArray(orderId)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-pos-base text-pos-text-muted">Invalid order ID</Text>
      </View>
    );
  }

  return <CheckoutContent orderIdStr={orderId} />;
}

// ── Main content ─────────────────────────────────────────────────────────────

interface CheckoutContentProps {
  orderIdStr: string;
}

function CheckoutContent({ orderIdStr }: CheckoutContentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeShift } = useShift();

  const orderId = parseInt(orderIdStr, 10);

  // ── Reactive order query ─────────────────────────────────────────────────────
  const { data: orderRows } = useQuery<OrderRow>(
    `SELECT o.*, t.table_number, b.name AS branch_name
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     LEFT JOIN branches b ON o.branch_id = b.id
     WHERE o.id = ?`,
    [orderId],
  );

  // ── Reactive items ───────────────────────────────────────────────────────────
  const { data: itemRows } = useQuery<OrderItem>(
    `SELECT * FROM order_items
     WHERE order_id = ? AND is_voided = 0
     ORDER BY round_number ASC, created_at ASC`,
    [orderId],
  );

  // ── Reactive modifiers (single join query for performance) ───────────────────
  const { data: allModifiers } = useQuery<OrderItemModifier>(
    `SELECT oim.*
     FROM order_item_modifiers oim
     INNER JOIN order_items oi ON oi.id = oim.order_item_id
     WHERE oi.order_id = ?`,
    [orderId],
  );

  const order = orderRows?.[0] ?? null;

  // Attach modifiers to items, memoized
  const itemsWithModifiers = useMemo<OrderItemRow[]>(() => {
    if (!itemRows) return [];
    return itemRows.map((item) => ({
      ...item,
      modifiers: (allModifiers ?? []).filter(
        (m) => toNum(m.order_item_id) === toNum(item.id),
      ),
    }));
  }, [itemRows, allModifiers]);

  // ── Local payment state ──────────────────────────────────────────────────────
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(
    PAYMENT_METHOD_TYPE.CASH,
  );
  const [cashInput, setCashInput] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<BillData | null>(null);

  // ── Discount state ────────────────────────────────────────────────────────────
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<OrderDiscount | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const discountsLoadedRef = useRef(false);

  // Load applied discount on mount
  useEffect(() => {
    if (!orderId) return;
    getOrderDiscount(orderId)
      .then(setAppliedDiscount)
      .catch((err) => console.error('[Checkout] Error loading discount:', err));
  }, [orderId]);

  // Lazy-load available discounts (only when picker opens for the first time)
  const handleOpenDiscountPicker = useCallback(async () => {
    setShowDiscountPicker(true);
    if (discountsLoadedRef.current) return;
    try {
      setDiscountsLoading(true);
      const discounts = await getActiveDiscounts();
      setAvailableDiscounts(discounts);
      discountsLoadedRef.current = true;
    } catch (err) {
      console.error('[Checkout] Error loading discounts:', err);
    } finally {
      setDiscountsLoading(false);
    }
  }, []);

  // ── Computed values ───────────────────────────────────────────────────────────
  const orderTotal      = useMemo(() => toNum(order?.total),           [order?.total]);
  const orderSubtotal   = useMemo(() => toNum(order?.subtotal),        [order?.subtotal]);
  const discountAmount  = useMemo(() => toNum(order?.discount_amount), [order?.discount_amount]);
  const taxAmount       = useMemo(() => toNum(order?.tax_amount),      [order?.tax_amount]);
  const serviceCharge   = useMemo(() => toNum(order?.service_charge),  [order?.service_charge]);
  const roundingAmount  = useMemo(() => toNum(order?.rounding_amount), [order?.rounding_amount]);

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
  const canComplete = totalTendered >= orderTotal && orderTotal > 0 && !isProcessing;

  // Approximate tax rate for label
  const taxBase = Math.max(1, orderSubtotal - discountAmount);
  const taxRateDisplay = Math.round((taxAmount / taxBase) * 100);

  // ── Payment handlers ──────────────────────────────────────────────────────────

  const handleMethodChange = useCallback((method: PaymentMethodType) => {
    setSelectedMethod(method);
    setCashInput('');
    setReferenceInput('');
  }, []);

  const handleCashExact = useCallback(() => {
    // Round up to nearest 100 for a natural cash amount
    const exact = Math.ceil(remainingBalance / 100) * 100;
    setCashInput(exact.toString());
  }, [remainingBalance]);

  const handleAddPayment = useCallback(() => {
    const amount = isCash
      ? parseFloat(cashInput) || 0
      : remainingBalance; // Non-cash always covers exactly the remaining

    if (amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    setPendingPayments((prev) => [
      ...prev,
      {
        id: generateLocalId(),
        method: selectedMethod,
        amount,
        referenceNumber: referenceInput.trim() || null,
      },
    ]);

    setCashInput('');
    setReferenceInput('');
  }, [selectedMethod, isCash, cashInput, referenceInput, remainingBalance]);

  const handleRemovePayment = useCallback((id: string) => {
    setPendingPayments((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Discount handlers ─────────────────────────────────────────────────────────

  const handleApplyDiscount = useCallback(
    async (discount: Discount) => {
      if (!user) return;
      try {
        const discountIdNum =
          typeof discount.id === 'string' ? parseInt(discount.id, 10) : discount.id;
        await applyOrderDiscount(orderId, discountIdNum, user.id);
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
    [orderId, user],
  );

  const handleRemoveDiscount = useCallback(async () => {
    try {
      await removeOrderDiscount(orderId);
      setAppliedDiscount(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove discount');
    }
  }, [orderId]);

  // ── Complete payment ──────────────────────────────────────────────────────────

  const handleComplete = useCallback(async () => {
    if (!canComplete || !order) return;

    setIsProcessing(true);
    try {
      const shiftId = activeShift
        ? typeof activeShift.id === 'string'
          ? parseInt(activeShift.id, 10)
          : activeShift.id
        : null;

      let balanceLeft = orderTotal;

      for (let i = 0; i < pendingPayments.length; i++) {
        const p = pendingPayments[i];
        const isLast = i === pendingPayments.length - 1;
        const change = isLast ? Math.max(0, p.amount - balanceLeft) : 0;

        await processPayment(orderId, shiftId, p.method, p.amount, change, p.referenceNumber);

        balanceLeft = Math.max(0, balanceLeft - p.amount);
      }

      await completeOrder(orderId);

      const receipt = await getBillData(orderId, true);
      setLastReceipt(receipt);
    } catch (err) {
      console.error('[Checkout] Payment error:', err);
      Alert.alert(
        'Payment Error',
        err instanceof Error ? err.message : 'Failed to process payment',
      );
    } finally {
      setIsProcessing(false);
    }
  }, [canComplete, order, orderId, activeShift, orderTotal, pendingPayments]);

  const handleReceiptDismiss = useCallback(() => {
    setLastReceipt(null);
    router.replace('/(app)/floor');
  }, [router]);

  // Guard: redirect if order already completed
  useEffect(() => {
    if (order && order.status === ORDER_STATUS.COMPLETED) {
      Alert.alert('Already Completed', 'This order has already been completed.', [
        { text: 'Go Back', onPress: () => router.back() },
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#6366F1" />
        <Text className="mt-3 text-pos-sm text-pos-text-muted">Loading order…</Text>
      </View>
    );
  }

  const tableLabel =
    order.order_type === 'takeaway'
      ? 'Takeaway 🛍️'
      : order.table_number
      ? `Table ${order.table_number}`
      : 'Order';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 flex-row bg-surface">

      {/* ── LEFT: Order summary ────────────────────────────────────────────────── */}
      <View className="border-r border-border" style={{ width: '50%' }}>

        {/* Header */}
        <View className="flex-row items-center gap-3 border-b border-border bg-surface-card px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
            })}
          >
            <Text style={{ fontSize: 13, color: '#94A3B8' }}>← Back</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#F8FAFC' }}>
              {tableLabel}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>{order.order_number}</Text>
          </View>

          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.15)' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#818CF8', letterSpacing: 0.8 }}>
              CHECKOUT
            </Text>
          </View>
        </View>

        {/* Item list */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {itemsWithModifiers.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#64748B' }}>
              No items
            </Text>
          ) : (
            itemsWithModifiers.map((item, index) => {
              const qty   = toNum(item.quantity);
              const price = toNum(item.unit_price);
              const total = toNum(item.total);

              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingVertical: 9,
                    borderTopWidth: index > 0 ? 1 : 0,
                    borderTopColor: 'rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Qty badge */}
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: 'rgba(99,102,241,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#818CF8' }}>
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}
                    </Text>
                  </View>

                  {/* Name + modifiers */}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#F8FAFC' }} numberOfLines={1}>
                      {item.menu_item_name}
                    </Text>
                    {item.modifiers.length > 0 && (
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {item.modifiers.map((m) => m.modifier_name).join(', ')}
                      </Text>
                    )}
                    {item.notes ? (
                      <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 1 }}>
                        {item.notes}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {formatIDR(price)} each
                    </Text>
                  </View>

                  {/* Row total */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#F8FAFC', flexShrink: 0 }}>
                    {formatIDR(total)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Totals footer */}
        <View
          className="border-t border-border bg-surface-card px-4 py-3"
          style={{ gap: 5 }}
        >
          <TotalsRow label="Subtotal"          value={formatIDR(orderSubtotal)} />
          {discountAmount > 0 && (
            <TotalsRow
              label={appliedDiscount ? `Discount (${appliedDiscount.discount_name})` : 'Discount'}
              value={`−${formatIDR(discountAmount)}`}
              valueColor="#10B981"
            />
          )}
          {taxAmount > 0 && (
            <TotalsRow
              label={`Tax (${taxRateDisplay || 11}%)`}
              value={formatIDR(taxAmount)}
            />
          )}
          {serviceCharge > 0 && (
            <TotalsRow label="Service Charge"  value={formatIDR(serviceCharge)} />
          )}
          {roundingAmount !== 0 && (
            <TotalsRow
              label="Rounding"
              value={`${roundingAmount > 0 ? '+' : ''}${formatIDR(roundingAmount)}`}
            />
          )}

          {/* Grand total */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.09)',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 }}>
              TOTAL DUE
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#6366F1' }}>
              {formatIDR(orderTotal)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── RIGHT: Payment panel ───────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Discount */}
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.9 }}>
                DISCOUNT
              </Text>
              <Pressable
                onPress={handleOpenDiscountPicker}
                style={({ pressed }) => ({
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: pressed ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(99,102,241,0.3)',
                })}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#818CF8' }}>
                  {appliedDiscount ? 'Change' : '+ Apply'}
                </Text>
              </Pressable>
            </View>

            {appliedDiscount ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(16,185,129,0.25)',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>🏷️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>
                    {appliedDiscount.discount_name}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    −{formatIDR(appliedDiscount.applied_amount)}
                  </Text>
                </View>
                <Pressable
                  onPress={handleRemoveDiscount}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Text style={{ fontSize: 14, color: '#EF4444', fontWeight: '700' }}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                No discount applied
              </Text>
            )}
          </SectionCard>

          {/* Payment method */}
          <SectionCard>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.9, marginBottom: 10 }}>
              PAYMENT METHOD
            </Text>
            <PaymentMethodSelector selected={selectedMethod} onSelect={handleMethodChange} />
          </SectionCard>

          {/* Amount entry */}
          <SectionCard>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.9, marginBottom: 10 }}>
              {isCash ? 'CASH AMOUNT' : 'PAYMENT DETAILS'}
            </Text>

            {isCash ? (
              <CashPayment
                value={cashInput}
                onChange={setCashInput}
                remainingBalance={remainingBalance}
                onExact={handleCashExact}
              />
            ) : (
              <NonCashInput
                remainingBalance={remainingBalance}
                referenceInput={referenceInput}
                onReferenceChange={setReferenceInput}
              />
            )}

            <Pressable
              onPress={handleAddPayment}
              style={({ pressed }) => ({
                marginTop: 12,
                height: 44,
                borderRadius: 8,
                backgroundColor: pressed ? '#4F46E5' : '#6366F1',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isCash && !cashInput ? 0.5 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                + Add Payment
              </Text>
            </Pressable>
          </SectionCard>

          {/* Pending payments list */}
          {pendingPayments.length > 0 && (
            <SectionCard>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 0.9, marginBottom: 10 }}>
                PAYMENTS ADDED
              </Text>
              <SplitPayment
                payments={pendingPayments}
                orderTotal={orderTotal}
                onRemove={handleRemovePayment}
              />
            </SectionCard>
          )}
        </ScrollView>

        {/* Sticky footer: summary + complete button */}
        <View className="border-t border-border bg-surface-card px-4 py-3" style={{ gap: 8 }}>
          {/* Balance / change summary line */}
          {pendingPayments.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {remainingBalance > 0 ? (
                <>
                  <Text style={{ fontSize: 13, color: '#94A3B8' }}>Remaining</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#F59E0B' }}>
                    {formatIDR(remainingBalance)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: '#94A3B8' }}>Change to give</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#10B981' }}>
                    {formatIDR(changeAmount)}
                  </Text>
                </>
              )}
            </View>
          )}

          <Pressable
            onPress={handleComplete}
            disabled={!canComplete}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 10,
              backgroundColor: canComplete
                ? pressed
                  ? '#4F46E5'
                  : '#6366F1'
                : 'rgba(99,102,241,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            })}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '900',
                    color: canComplete ? '#fff' : 'rgba(255,255,255,0.35)',
                    letterSpacing: 0.3,
                  }}
                >
                  Complete &amp; Print Receipt
                </Text>
                <Text style={{ fontSize: 18 }}>🧾</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

      <DiscountSelector
        visible={showDiscountPicker}
        discounts={availableDiscounts}
        appliedDiscount={appliedDiscount}
        orderSubtotal={orderSubtotal}
        onApply={handleApplyDiscount}
        onRemove={handleRemoveDiscount}
        onClose={() => setShowDiscountPicker(false)}
        isLoading={discountsLoading}
      />

      <ReceiptPreview bill={lastReceipt} onDismiss={handleReceiptDismiss} />
    </View>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#1A1F2C',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </View>
  );
}

function TotalsRow({
  label,
  value,
  valueColor = '#F8FAFC',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#64748B' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: valueColor }}>{value}</Text>
    </View>
  );
}

interface NonCashInputProps {
  remainingBalance: number;
  referenceInput: string;
  onReferenceChange: (value: string) => void;
}

function NonCashInput({ remainingBalance, referenceInput, onReferenceChange }: NonCashInputProps) {
  return (
    <View style={{ gap: 10 }}>
      {/* Auto-set amount indicator */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          borderRadius: 8,
          backgroundColor: 'rgba(99,102,241,0.1)',
          borderWidth: 1,
          borderColor: 'rgba(99,102,241,0.25)',
        }}
      >
        <Text style={{ fontSize: 12, color: '#94A3B8' }}>Amount (auto-filled)</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#818CF8' }}>
          {formatIDR(remainingBalance)}
        </Text>
      </View>

      {/* Optional reference number */}
      <View>
        <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 5 }}>
          Reference No. (optional)
        </Text>
        <TextInput
          value={referenceInput}
          onChangeText={onReferenceChange}
          placeholder="e.g. QRIS txn ID, slip number…"
          placeholderTextColor="#475569"
          style={{
            height: 42,
            borderRadius: 8,
            paddingHorizontal: 12,
            fontSize: 13,
            color: '#F8FAFC',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.09)',
          }}
        />
      </View>
    </View>
  );
}
