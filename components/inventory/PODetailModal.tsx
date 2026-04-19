import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { PURCHASE_STATUS } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import type { Purchase } from '@/hooks/use-purchases';
import { formatIDR } from '@/utils/currency';
import { POStatusBadge } from './POStatusBadge';
import { UOM_LABELS } from './UomDropdown';
import { formatQty } from './shared';

// ─── PODetailModal ────────────────────────────────────────────────────────────

export interface PODetailModalProps {
  purchaseId: number | null;
  onClose: () => void;
  onReceive: (id: number, paidAmount: number, notes?: string) => Promise<Purchase>;
  onCancel: (id: number) => Promise<Purchase>;
  getPurchase: (id: number) => Promise<Purchase>;
}

export function PODetailModal({ purchaseId, onClose, onReceive, onCancel, getPurchase }: PODetailModalProps) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const remaining = purchase ? purchase.total - purchase.paid_amount : 0;
  const parsedPay = parseFloat(payAmount) || 0;
  const payValid = parsedPay > 0 && parsedPay <= remaining;

  useEffect(() => {
    if (!purchaseId) {
      setPurchase(null);
      setPayAmount('');
      setPayNotes('');
      return;
    }
    setLoading(true);
    getPurchase(purchaseId)
      .then((p) => {
        setPurchase(p);
        setPayAmount(String(p.total - p.paid_amount));
        setPayNotes('');
      })
      .catch(() => Alert.alert('Error', 'Failed to load purchase details'))
      .finally(() => setLoading(false));
  }, [purchaseId, getPurchase]);

  if (!purchaseId) return null;

  const canReceive =
    purchase?.status === PURCHASE_STATUS.ORDERED ||
    purchase?.status === PURCHASE_STATUS.PARTIAL_RECEIVED;

  const canCancel =
    purchase?.status === PURCHASE_STATUS.ORDERED ||
    purchase?.status === PURCHASE_STATUS.PARTIAL_RECEIVED;

  async function handleReceive() {
    if (!payValid) return;
    const isFirst = purchase!.paid_amount === 0;
    const willComplete = parsedPay >= remaining;
    const msg = isFirst
      ? `Record payment of ${formatIDR(parsedPay)} and add all items to inventory?`
      : willComplete
        ? `Record final payment of ${formatIDR(parsedPay)}? This will mark the PO as fully received.`
        : `Record partial payment of ${formatIDR(parsedPay)}? Remaining after: ${formatIDR(remaining - parsedPay)}`;

    Alert.alert('Record Payment', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: willComplete ? 'Pay & Complete' : 'Record Payment',
        style: 'default',
        onPress: async () => {
          setActing(true);
          try {
            const updated = await onReceive(purchaseId!, parsedPay, payNotes || undefined);
            setPurchase(updated);
            setPayAmount(String(updated.total - updated.paid_amount));
            setPayNotes('');
            if (updated.total - updated.paid_amount <= 0) onClose();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record payment');
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  async function handleCancel() {
    Alert.alert('Cancel Purchase', 'Cancel this purchase order? This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel PO',
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            await onCancel(purchaseId!);
            onClose();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel purchase');
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  function handlePayFullRemaining() {
    setPayAmount(String(remaining));
  }

  return (
    <Modal visible={!!purchaseId} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
        <View className="rounded-lg bg-surface-card border border-border overflow-hidden" style={{ width: 520, maxWidth: '92%', maxHeight: 640 }}>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3 bg-surface-raised">
            <View className="flex-1">
              <Text className="text-pos-lg font-bold font-mono text-pos-text">{purchase?.purchase_number ?? '…'}</Text>
              {purchase && (
                <Text className="text-pos-xs text-pos-text-faint">{purchase.supplier_name}</Text>
              )}
            </View>
            {purchase && <POStatusBadge status={purchase.status} />}
            <Pressable onPress={onClose} hitSlop={8} className="p-1">
              <X size={20} color={ThemeColors.text.muted} />
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center justify-center p-12">
              <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
            </View>
          ) : !purchase ? null : (
            <>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

                {/* Received banner */}
                {purchase.status === PURCHASE_STATUS.RECEIVED && purchase.received_at && (
                  <View
                    className="flex-row items-center gap-3 rounded-sm border px-4 py-3"
                    style={{ borderColor: ThemeColors.success.border, backgroundColor: ThemeColors.success.dim }}
                  >
                    <View className="flex-1">
                      <Text className="text-pos-xs font-semibold" style={{ color: ThemeColors.success.DEFAULT }}>
                        Fully paid
                      </Text>
                      <Text className="text-pos-base font-bold text-pos-text">
                        {purchase.received_by_name || '—'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-pos-xs text-pos-text-faint">Completed on</Text>
                      <Text className="font-mono text-pos-sm font-semibold text-pos-text">
                        {new Date(purchase.received_at).toLocaleDateString('id-ID', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </Text>
                      <Text className="font-mono text-pos-xs text-pos-text-faint">
                        {new Date(purchase.received_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Payment progress */}
                <View className="rounded-sm bg-surface-raised px-3 py-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-pos-xs font-semibold text-pos-text-faint">Payment Progress</Text>
                    <Text className="font-mono text-pos-xs text-pos-text-muted">
                      {formatIDR(purchase.paid_amount)} / {formatIDR(purchase.total)}
                    </Text>
                  </View>
                  {/* Progress bar */}
                  <View className="h-2 rounded-full bg-surface" style={{ overflow: 'hidden' }}>
                    <View
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min((purchase.paid_amount / purchase.total) * 100, 100)}%`,
                        backgroundColor: purchase.paid_amount >= purchase.total
                          ? ThemeColors.success.DEFAULT
                          : purchase.paid_amount > 0
                            ? ThemeColors.warning.DEFAULT
                            : ThemeColors.text.faint,
                      }}
                    />
                  </View>
                  {remaining > 0 && (
                    <Text className="mt-1 font-mono text-pos-sm font-bold" style={{ color: ThemeColors.warning.DEFAULT }}>
                      Remaining: {formatIDR(remaining)}
                    </Text>
                  )}
                </View>

                {/* Info row */}
                <View className="flex-row gap-3">
                  <View className="flex-1 rounded-sm bg-surface-raised px-3 py-2">
                    <Text className="text-pos-xs text-pos-text-faint">Ordered by</Text>
                    <Text className="text-pos-sm font-semibold text-pos-text">{purchase.ordered_by_name || '—'}</Text>
                  </View>
                  <View className="flex-1 rounded-sm bg-surface-raised px-3 py-2">
                    <Text className="text-pos-xs text-pos-text-faint">Total</Text>
                    <Text className="font-mono text-pos-lg font-bold text-pos-text">{formatIDR(purchase.total)}</Text>
                  </View>
                  {purchase.tax_amount > 0 && (
                    <View className="flex-1 rounded-sm bg-surface-raised px-3 py-2">
                      <Text className="text-pos-xs text-pos-text-faint">Tax</Text>
                      <Text className="font-mono text-pos-sm text-pos-text">{formatIDR(purchase.tax_amount)}</Text>
                    </View>
                  )}
                </View>

                {purchase.notes ? (
                  <Text className="text-pos-xs text-pos-text-muted italic">{purchase.notes}</Text>
                ) : null}

                {/* Payment input (only when receivable) */}
                {canReceive && (
                  <View className="rounded-sm border border-border bg-surface px-3 py-3" style={{ gap: 8 }}>
                    <Text className="text-pos-xs font-semibold text-pos-text-muted">Record Payment</Text>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-pos-sm font-bold text-pos-text">Rp</Text>
                      <TextInput
                        value={payAmount}
                        onChangeText={setPayAmount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={ThemeColors.text.faint}
                        className="flex-1 rounded-sm border border-border bg-surface-card px-3 font-mono text-pos-lg font-bold text-pos-text"
                        style={{ height: 44 }}
                      />
                      <Pressable
                        onPress={handlePayFullRemaining}
                        className="rounded-sm px-3"
                        style={{ height: 44, justifyContent: 'center', backgroundColor: ThemeColors.surfaces.raised }}
                      >
                        <Text className="text-pos-xs font-bold" style={{ color: ThemeColors.accent.primary }}>Full</Text>
                      </Pressable>
                    </View>
                    {parsedPay > remaining && (
                      <Text className="text-pos-xs" style={{ color: ThemeColors.danger.DEFAULT }}>
                        Exceeds remaining {formatIDR(remaining)}
                      </Text>
                    )}
                    <TextInput
                      value={payNotes}
                      onChangeText={setPayNotes}
                      placeholder="Payment notes (optional)"
                      placeholderTextColor={ThemeColors.text.faint}
                      className="rounded-sm border border-border bg-surface-card px-3 text-pos-sm text-pos-text"
                      style={{ height: 38 }}
                    />
                  </View>
                )}

                {/* Items list */}
                {(purchase.items ?? []).length > 0 && (
                  <View>
                    <Text className="mb-2 text-pos-xs font-semibold text-pos-text-muted">Items</Text>
                    {(purchase.items ?? []).map((item) => (
                      <View key={item.id} className="mb-2 rounded-sm bg-surface-raised px-3 py-3">
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="flex-1 text-pos-base font-semibold text-pos-text">{item.inventory_name}</Text>
                          <Text className="font-mono text-pos-lg font-bold text-pos-text">
                            {formatIDR(item.total)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <Text className="font-mono text-pos-base font-bold" style={{ color: ThemeColors.accent.primary }}>
                            {formatQty(item.quantity)} {UOM_LABELS[item.unit_of_measure] ?? item.unit_of_measure}
                          </Text>
                          <Text className="text-pos-sm text-pos-text-faint">
                            @ {formatIDR(item.cost_per_unit)} / {UOM_LABELS[item.unit_of_measure] ?? item.unit_of_measure}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

              </ScrollView>

              {/* Action footer */}
              {canReceive && (
                <View className="flex-row gap-2 border-t border-border px-4 py-3 bg-surface-raised">
                  {canCancel && (
                    <Pressable
                      onPress={handleCancel}
                      disabled={acting}
                      className="items-center justify-center rounded-sm px-4"
                      style={{ height: 42, backgroundColor: ThemeColors.danger.badge }}
                    >
                      <Text className="text-pos-sm font-bold" style={{ color: ThemeColors.danger.DEFAULT }}>Cancel PO</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={handleReceive}
                    disabled={acting || !payValid}
                    className="flex-1 items-center justify-center rounded-sm"
                    style={{
                      height: 42,
                      backgroundColor: acting || !payValid
                        ? ThemeColors.surfaces.disabled
                        : ThemeColors.success.DEFAULT,
                    }}
                  >
                    {acting
                      ? <ActivityIndicator size="small" color={ThemeColors.text.strong} />
                      : (
                        <Text className="text-pos-sm font-bold text-white">
                          {parsedPay >= remaining ? 'Pay & Complete' : 'Record Payment'}
                        </Text>
                      )}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
