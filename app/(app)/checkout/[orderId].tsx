import { useQuery } from '@powersync/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, FileText, Receipt, ShoppingBag, Tag, X } from 'lucide-react-native';
import { ThemeColors } from '@/constants/theme';
import { toInt } from '@/utils/coerce';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Button, IconButton, PrimaryButton } from '@/components/ui';

import { CashPayment } from '@/components/payment/CashPayment';
import { DiscountSelector } from '@/components/payment/DiscountSelector';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import type { PendingPayment } from '@/components/payment/SplitPayment';
import { SplitPayment } from '@/components/payment/SplitPayment';
import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
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
import { calculateOrderTotals } from '@/services/order.service';
import type { BillData } from '@/services/receipt.service';
import { getBillData } from '@/services/receipt.service';
import type { KOTWithItems } from '@/services/kitchen.service';
import { getKOTsForOrder } from '@/services/kitchen.service';

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
  const { orderId, viewOnly } = useLocalSearchParams<{ orderId: string; viewOnly?: string }>();

  if (!orderId || Array.isArray(orderId)) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-pos-base text-pos-text-muted">Invalid order ID</Text>
      </View>
    );
  }

  return <CheckoutContent orderIdStr={orderId} viewOnly={viewOnly === '1'} />;
}

// ── Main content ─────────────────────────────────────────────────────────────

interface CheckoutContentProps {
  orderIdStr: string;
  viewOnly?: boolean;
}

function CheckoutContent({ orderIdStr, viewOnly = false }: CheckoutContentProps) {
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
  const [lastKOT, setLastKOT] = useState<KOTWithItems | null>(null);
  const [kots, setKots] = useState<KOTWithItems[]>([]);
  const [kotIndex, setKotIndex] = useState(0);

  // ── Discount state ────────────────────────────────────────────────────────────
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<OrderDiscount | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const discountsLoadedRef = useRef(false);

  // Recalculate totals on mount so tax/service charge reflect the current branch rates
  useEffect(() => {
    if (!orderId) return;
    calculateOrderTotals(orderId).catch((err) =>
      console.error('[Checkout] Error recalculating totals:', err),
    );
  }, [orderId]);

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
        const discountIdNum = toInt(discount.id);
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
    if (!viewOnly) router.replace('/(app)/floor');
  }, [router, viewOnly]);

  // View-only: print receipt by loading bill data
  const handleViewReceipt = useCallback(async () => {
    try {
      const receipt = await getBillData(orderId, false);
      setLastReceipt(receipt);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load receipt');
    }
  }, [orderId]);

  // View-only: cycle through KOTs
  const handleViewKOT = useCallback(() => {
    if (kots.length === 0) {
      Alert.alert('No KOTs', 'No kitchen order tickets found for this order.');
      return;
    }
    setLastKOT(kots[kotIndex]);
    setKotIndex((prev) => (prev + 1) % kots.length);
  }, [kots, kotIndex]);

  // Guard: redirect if order was already completed BEFORE we opened checkout
  // (skip in viewOnly mode — we intentionally open completed orders for viewing)
  const wasAlreadyCompleted = useRef(false);
  useEffect(() => {
    if (!order || viewOnly) return;
    if (order.status === ORDER_STATUS.COMPLETED && !lastReceipt && !isProcessing) {
      wasAlreadyCompleted.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  useEffect(() => {
    if (viewOnly) return;
    if (wasAlreadyCompleted.current && order?.status === ORDER_STATUS.COMPLETED) {
      Alert.alert('Already Completed', 'This order has already been completed.', [
        { text: 'Go to Floor', onPress: () => router.replace('/(app)/floor') },
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  // View-only: load KOTs for this order
  useEffect(() => {
    if (!viewOnly || !orderId) return;
    getKOTsForOrder(orderId).then(setKots).catch(() => {});
  }, [viewOnly, orderId]);

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#6366F1" />
        <Text className="mt-3 text-pos-sm text-pos-text-muted">Loading order…</Text>
      </View>
    );
  }

  const isTakeaway = order.order_type === 'takeaway';
  const tableLabel =
    isTakeaway
      ? null
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
          <Button
            onPress={() => router.back()}
            className="rounded border border-border bg-surface-raised px-2.5 py-1.5"
          >
            <View className="flex-row items-center gap-1">
              <ChevronLeft size={14} color={ThemeColors.text.muted} />
              <Text className="text-pos-sm text-pos-text-muted">Back</Text>
            </View>
          </Button>

          <View style={{ flex: 1 }}>
            {isTakeaway ? (
              <View className="flex-row items-center gap-1.5">
                <ShoppingBag size={14} color={ThemeColors.text.primary} />
                <Text className="text-pos-base font-extrabold text-pos-text">Takeaway</Text>
              </View>
            ) : (
              <Text className="text-pos-base font-extrabold text-pos-text">{tableLabel}</Text>
            )}
            <Text className="text-pos-xs text-pos-text-faint">{order.order_number}</Text>
          </View>

          <View className="rounded-full bg-accent-muted px-2.5 py-1">
            <Text className="text-[10px] font-extrabold tracking-widest text-accent">
              {viewOnly ? 'VIEW ONLY' : 'CHECKOUT'}
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
            <Text className="mt-8 text-center text-pos-sm text-pos-text-faint">
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
                  className={`flex-row items-start py-2 ${index > 0 ? 'border-t border-border' : ''}`}
                >
                  {/* Qty badge */}
                  <View className="mr-2.5 mt-0.5 h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-muted">
                    <Text className="text-[11px] font-black text-accent-hover">
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}
                    </Text>
                  </View>

                  {/* Name + modifiers */}
                  <View className="mr-2 flex-1">
                    <Text className="text-pos-sm font-semibold text-pos-text" numberOfLines={1}>
                      {item.menu_item_name}
                    </Text>
                    {item.modifiers.length > 0 && (
                      <Text className="mt-0.5 text-pos-xs text-pos-text-faint">
                        {item.modifiers.map((m) => m.modifier_name).join(', ')}
                      </Text>
                    )}
                    {item.notes ? (
                      <Text className="mt-0.5 text-pos-xs italic text-pos-text-faint">
                        {item.notes}
                      </Text>
                    ) : null}
                    <Text className="mt-0.5 text-pos-xs text-pos-text-muted">
                      {formatIDR(price)} each
                    </Text>
                  </View>

                  {/* Row total */}
                  <Text className="shrink-0 text-pos-sm font-bold text-pos-text">
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
              valueClassName="text-pos-success"
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
          <View className="mt-1.5 flex-row items-center justify-between border-t border-border pt-2">
            <Text className="text-pos-sm font-extrabold tracking-widest text-pos-text-muted">
              TOTAL DUE
            </Text>
            <Text className="text-pos-3xl font-black text-accent">
              {formatIDR(orderTotal)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── RIGHT: Payment panel OR View-only panel ────────────────────────────── */}
      {viewOnly ? (
        /* ── VIEW-ONLY: status + print actions ──────────────────────────────── */
        <View style={{ flex: 1 }} className="border-l border-border">
          <View className="flex-1 items-center justify-center px-6" style={{ gap: 16 }}>
            {/* Order status */}
            <SectionCard>
              <Text className="mb-2 text-[11px] font-bold tracking-widest text-pos-text-faint">ORDER STATUS</Text>
              <View className="flex-row items-center gap-3">
                <View
                  className="rounded-lg px-3 py-1.5"
                  style={{
                    backgroundColor:
                      order.status === 'completed' ? ThemeColors.success.dim :
                      order.status === 'cancelled' ? ThemeColors.danger.muted :
                      ThemeColors.accent.primaryMuted,
                  }}
                >
                  <Text
                    className="text-pos-sm font-extrabold"
                    style={{
                      color:
                        order.status === 'completed' ? ThemeColors.success.DEFAULT :
                        order.status === 'cancelled' ? ThemeColors.danger.DEFAULT :
                        ThemeColors.accent.primary,
                    }}
                  >
                    {order.status.toUpperCase()}
                  </Text>
                </View>
                <View
                  className="rounded-lg px-3 py-1.5"
                  style={{
                    backgroundColor:
                      order.payment_status === 'paid' ? ThemeColors.success.dim :
                      order.payment_status === 'partial' ? ThemeColors.warning.muted :
                      ThemeColors.danger.muted,
                  }}
                >
                  <Text
                    className="text-pos-sm font-extrabold"
                    style={{
                      color:
                        order.payment_status === 'paid' ? ThemeColors.success.DEFAULT :
                        order.payment_status === 'partial' ? ThemeColors.warning.DEFAULT :
                        ThemeColors.danger.DEFAULT,
                    }}
                  >
                    {order.payment_status?.toUpperCase() ?? 'UNPAID'}
                  </Text>
                </View>
              </View>
            </SectionCard>

            {/* Print actions */}
            <Button
              onPress={handleViewReceipt}
              className="w-full h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface-card"
            >
              <Receipt size={18} color={ThemeColors.accent.primary} />
              <Text className="text-pos-base font-bold" style={{ color: ThemeColors.accent.primary }}>
                View Receipt / Bill
              </Text>
            </Button>

            <Button
              onPress={handleViewKOT}
              className="w-full h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface-card"
            >
              <FileText size={18} color={ThemeColors.text.muted} />
              <Text className="text-pos-base font-bold text-pos-text-muted">
                {kots.length > 1 ? `View KOT (${kots.length} rounds)` : 'View KOT'}
              </Text>
            </Button>
          </View>
        </View>
      ) : (
        /* ── CHECKOUT: full payment panel ────────────────────────────────────── */
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Discount */}
            <SectionCard>
              <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-[11px] font-bold tracking-widest text-pos-text-faint">DISCOUNT</Text>
                <Button
                  onPress={handleOpenDiscountPicker}
                  className="rounded border border-accent/30 bg-accent/10 px-2.5 py-1"
                >
                  <Text className="text-[11px] font-bold text-accent-hover">
                    {appliedDiscount ? 'Change' : '+ Apply'}
                  </Text>
                </Button>
              </View>

              {appliedDiscount ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-pos-success/30 bg-pos-success/10 p-2.5">
                  <Tag size={16} color={ThemeColors.success.DEFAULT} />
                  <View className="flex-1">
                    <Text className="text-pos-xs font-bold text-pos-success">
                      {appliedDiscount.discount_name}
                    </Text>
                    <Text className="text-pos-xs text-pos-text-faint">
                      −{formatIDR(appliedDiscount.applied_amount)}
                    </Text>
                  </View>
                  <IconButton
                    onPress={handleRemoveDiscount}
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

            {/* Payment method */}
            <SectionCard>
              <Text className="mb-2.5 text-[11px] font-bold tracking-widest text-pos-text-faint">
                PAYMENT METHOD
              </Text>
              <PaymentMethodSelector selected={selectedMethod} onSelect={handleMethodChange} />
            </SectionCard>

            {/* Amount entry */}
            <SectionCard>
              <Text className="mb-2.5 text-[11px] font-bold tracking-widest text-pos-text-faint">
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

              <PrimaryButton
                onPress={handleAddPayment}
                disabled={isCash && !cashInput}
                className="mt-3 h-11 rounded-lg"
              >
                <Text className="text-pos-sm font-extrabold text-white">
                  + Add Payment
                </Text>
              </PrimaryButton>
            </SectionCard>

            {/* Pending payments list */}
            {pendingPayments.length > 0 && (
              <SectionCard>
                <Text className="mb-2.5 text-[11px] font-bold tracking-widest text-pos-text-faint">
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
            {pendingPayments.length > 0 && (
              <View className="flex-row items-center justify-between">
                {remainingBalance > 0 ? (
                  <>
                    <Text className="text-pos-sm text-pos-text-muted">Remaining</Text>
                    <Text className="text-pos-base font-extrabold text-pos-warning">
                      {formatIDR(remainingBalance)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-pos-sm text-pos-text-muted">Change to give</Text>
                    <Text className="text-pos-base font-extrabold text-pos-success">
                      {formatIDR(changeAmount)}
                    </Text>
                  </>
                )}
              </View>
            )}

            <Button
              onPress={handleComplete}
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
        </View>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

      {!viewOnly && (
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
      )}

      <ReceiptPreview bill={lastReceipt} onDismiss={handleReceiptDismiss} />
      <KOTTicketPreview kot={lastKOT} onDismiss={() => setLastKOT(null)} />
    </View>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-border bg-surface-card p-3">
      {children}
    </View>
  );
}

function TotalsRow({
  label,
  value,
  valueClassName = 'text-pos-text',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-pos-xs text-pos-text-faint">{label}</Text>
      <Text className={`text-pos-xs font-semibold ${valueClassName}`}>{value}</Text>
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
    <View className="gap-2.5">
      {/* Auto-set amount indicator */}
      <View className="flex-row items-center justify-between rounded-lg border border-accent/25 bg-accent/10 p-3">
        <Text className="text-pos-xs text-pos-text-muted">Amount (auto-filled)</Text>
        <Text className="text-pos-lg font-extrabold text-accent-hover">
          {formatIDR(remainingBalance)}
        </Text>
      </View>

      {/* Optional reference number */}
      <View>
        <Text className="mb-1 text-pos-xs text-pos-text-faint">
          Reference No. (optional)
        </Text>
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
