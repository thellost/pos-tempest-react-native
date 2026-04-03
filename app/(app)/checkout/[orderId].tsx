import { useQuery } from '@powersync/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { KOTTicketPreview } from '@/components/kitchen/KOTTicketPreview';
import { DiscountSelector } from '@/components/payment/DiscountSelector';
import { ReceiptPreview } from '@/components/print/ReceiptPreview';
import { CheckoutPaymentPanel } from '@/components/checkout/CheckoutPaymentPanel';
import { OrderSummaryPanel } from '@/components/checkout/OrderSummaryPanel';
import type { OrderItemRow, OrderRow } from '@/components/checkout/OrderSummaryPanel';
import { ViewOnlyPanel } from '@/components/checkout/ViewOnlyPanel';
import { ORDER_STATUS } from '@/constants/enums';
import type { OrderItem, OrderItemModifier } from '@/db/models';
import { useAuth } from '@/hooks/use-auth';
import { useCheckoutPayment } from '@/hooks/use-checkout-payment';
import { useOrderDiscount } from '@/hooks/use-order-discount';
import { useShift } from '@/hooks/use-shift';
import { toFloat } from '@/utils/coerce';
import { completeOrder, processPayment } from '@/services/payment.service';
import { calculateOrderTotals } from '@/services/order.service';
import type { KOTWithItems } from '@/services/kitchen.service';
import { getKOTsForOrder } from '@/services/kitchen.service';
import type { BillData } from '@/services/receipt.service';
import { getBillData } from '@/services/receipt.service';
import { printBill } from '@/lib/printer';


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

function CheckoutContent({
  orderIdStr,
  viewOnly = false,
}: {
  orderIdStr: string;
  viewOnly?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeShift } = useShift();
  const orderId = orderIdStr;

  const { data: orderRows } = useQuery<OrderRow>(
    `SELECT o.*, t.table_number, b.name AS branch_name, b.tax_rate, b.service_charge_rate
     FROM orders o
     LEFT JOIN tables t ON o.table_id = t.id
     LEFT JOIN branches b ON o.branch_id = b.id
     WHERE o.id = ?`,
    [orderId],
  );
  const { data: itemRows } = useQuery<OrderItem>(
    `SELECT * FROM order_items
     WHERE order_id = ? AND is_voided = 0
     ORDER BY round_number ASC, created_at ASC`,
    [orderId],
  );
  const { data: allModifiers } = useQuery<OrderItemModifier>(
    `SELECT oim.*
     FROM order_item_modifiers oim
     INNER JOIN order_items oi ON oi.id = oim.order_item_id
     WHERE oi.order_id = ?`,
    [orderId],
  );

  const order = orderRows?.[0] ?? null;
  const itemsWithModifiers = useMemo<OrderItemRow[]>(() => {
    if (!itemRows) return [];
    return itemRows.map(item => ({
      ...item,
      modifiers: (allModifiers ?? []).filter(
        m => toFloat(m.order_item_id) === toFloat(item.id),
      ),
    }));
  }, [itemRows, allModifiers]);

  const orderTotal = toFloat(order?.total);
  const payment  = useCheckoutPayment(orderTotal);
  const discount = useOrderDiscount(orderId, user?.id);

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<BillData | null>(null);
  const [lastKOT, setLastKOT] = useState<KOTWithItems | null>(null);
  const [kots, setKots] = useState<KOTWithItems[]>([]);
  const [kotIndex, setKotIndex] = useState(0);

  const canComplete = payment.totalTendered >= orderTotal && orderTotal > 0 && !isProcessing;

  // Recalculate totals on mount to apply current branch tax/service-charge rates
  useEffect(() => {
    calculateOrderTotals(orderId).catch(err =>
      console.error('[Checkout] Error recalculating totals:', err),
    );
  }, [orderId]);

  // Guard: alert and redirect if the order was already completed before this screen opened
  const alreadyCompletedOnMount = useRef<boolean | null>(null);
  useEffect(() => {
    if (viewOnly || !order) return;
    if (alreadyCompletedOnMount.current === null) {
      alreadyCompletedOnMount.current = order.status === ORDER_STATUS.COMPLETED;
      if (alreadyCompletedOnMount.current) {
        Alert.alert('Already Completed', 'This order has already been completed.', [
          { text: 'Go to Floor', onPress: () => router.replace('/(app)/floor') },
        ]);
      }
    }
  }, [order?.status, viewOnly, router]);

  useEffect(() => {
    if (!viewOnly) return;
    getKOTsForOrder(orderId).then(setKots).catch(() => {});
  }, [viewOnly, orderId]);

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
      for (let i = 0; i < payment.pendingPayments.length; i++) {
        const p = payment.pendingPayments[i];
        const isLast = i === payment.pendingPayments.length - 1;
        const change = isLast ? Math.max(0, p.amount - balanceLeft) : 0;
        await processPayment(orderId, shiftId, p.method, p.amount, change, p.referenceNumber);
        balanceLeft = Math.max(0, balanceLeft - p.amount);
      }

      await completeOrder(orderId);
      const receipt = await getBillData(orderId, true);
      setLastReceipt(receipt);
      printBill('cashier', receipt).catch(() => {});
    } catch (err) {
      console.error('[Checkout] Payment error:', err);
      Alert.alert(
        'Payment Error',
        err instanceof Error ? err.message : 'Failed to process payment',
      );
    } finally {
      setIsProcessing(false);
    }
  }, [canComplete, order, orderId, activeShift, orderTotal, payment.pendingPayments]);

  const handleReceiptDismiss = useCallback(() => {
    setLastReceipt(null);
    if (!viewOnly) router.replace('/(app)/floor');
  }, [router, viewOnly]);

  const handleViewReceipt = useCallback(async () => {
    try {
      const receipt = await getBillData(orderId, false);
      setLastReceipt(receipt);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load receipt');
    }
  }, [orderId]);

  const handleViewKOT = useCallback(() => {
    if (kots.length === 0) {
      Alert.alert('No KOTs', 'No kitchen order tickets found for this order.');
      return;
    }
    setLastKOT(kots[kotIndex]);
    setKotIndex(prev => (prev + 1) % kots.length);
  }, [kots, kotIndex]);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color="#6366F1" />
        <Text className="mt-3 text-pos-sm text-pos-text-muted">Loading order…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row bg-surface">
      <OrderSummaryPanel
        order={order}
        items={itemsWithModifiers}
        viewOnly={viewOnly}
        appliedDiscount={discount.appliedDiscount}
        onBack={() => router.back()}
      />

      {viewOnly ? (
        <ViewOnlyPanel
          order={order}
          kots={kots}
          onViewReceipt={handleViewReceipt}
          onViewKOT={handleViewKOT}
        />
      ) : (
        <CheckoutPaymentPanel
          payment={payment}
          discount={discount}
          orderTotal={orderTotal}
          isProcessing={isProcessing}
          canComplete={canComplete}
          onComplete={handleComplete}
        />
      )}

      {!viewOnly && (
        <DiscountSelector
          visible={discount.showDiscountPicker}
          discounts={discount.availableDiscounts}
          appliedDiscount={discount.appliedDiscount}
          orderSubtotal={toFloat(order.subtotal)}
          onApply={discount.onApply}
          onRemove={discount.onRemove}
          onClose={discount.onClose}
          isLoading={discount.isLoading}
        />
      )}

      <ReceiptPreview bill={lastReceipt} onDismiss={handleReceiptDismiss} />
      <KOTTicketPreview kot={lastKOT} onDismiss={() => setLastKOT(null)} />
    </View>
  );
}
