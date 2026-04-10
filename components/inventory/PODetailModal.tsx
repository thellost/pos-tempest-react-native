import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
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
  onReceive: (id: number, notes?: string) => Promise<Purchase>;
  onCancel: (id: number) => Promise<Purchase>;
  getPurchase: (id: number) => Promise<Purchase>;
}

export function PODetailModal({ purchaseId, onClose, onReceive, onCancel, getPurchase }: PODetailModalProps) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!purchaseId) { setPurchase(null); return; }
    setLoading(true);
    getPurchase(purchaseId)
      .then(setPurchase)
      .catch(() => Alert.alert('Error', 'Failed to load purchase details'))
      .finally(() => setLoading(false));
  }, [purchaseId, getPurchase]);

  if (!purchaseId) return null;

  async function handleReceive() {
    Alert.alert('Receive Purchase', 'Mark this PO as received? This will add all items to inventory.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Receive', style: 'default', onPress: async () => {
          setActing(true);
          try {
            await onReceive(purchaseId!);
            onClose();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to receive purchase');
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
        text: 'Cancel PO', style: 'destructive', onPress: async () => {
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

  const isOrdered = purchase?.status === PURCHASE_STATUS.ORDERED;

  return (
    <Modal visible={!!purchaseId} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
        <View className="rounded-lg bg-surface-card border border-border overflow-hidden" style={{ width: 520, maxWidth: '92%', maxHeight: 580 }}>

          <View className="flex-row items-center justify-between border-b border-border px-4 py-3 bg-surface-raised">
            <View className="flex-1">
              <Text className="text-pos-lg font-bold font-mono text-pos-text">{purchase?.purchase_number ?? '…'}</Text>
              {purchase && (
                <Text className="text-pos-xs text-pos-text-faint">{purchase.supplier_name}</Text>
              )}
            </View>
            {purchase && (
              <POStatusBadge status={purchase.status} />
            )}
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

                {purchase.status === PURCHASE_STATUS.RECEIVED && purchase.received_at && (
                  <View
                    className="flex-row items-center gap-3 rounded-sm border px-4 py-3"
                    style={{ borderColor: ThemeColors.success.border, backgroundColor: ThemeColors.success.dim }}
                  >
                    <View className="flex-1">
                      <Text className="text-pos-xs font-semibold" style={{ color: ThemeColors.success.DEFAULT }}>
                        Stock received
                      </Text>
                      <Text className="text-pos-base font-bold text-pos-text">
                        {purchase.received_by_name || '—'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-pos-xs text-pos-text-faint">Received on</Text>
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

              {isOrdered && (
                <View className="flex-row gap-2 border-t border-border px-4 py-3 bg-surface-raised">
                  <Pressable
                    onPress={handleCancel}
                    disabled={acting}
                    className="flex-1 items-center justify-center rounded-sm"
                    style={{ height: 42, backgroundColor: ThemeColors.danger.badge }}
                  >
                    <Text className="text-pos-sm font-bold" style={{ color: ThemeColors.danger.DEFAULT }}>Cancel PO</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleReceive}
                    disabled={acting}
                    className="flex-1 items-center justify-center rounded-sm"
                    style={{ height: 42, backgroundColor: acting ? ThemeColors.surfaces.disabled : ThemeColors.success.DEFAULT }}
                  >
                    {acting
                      ? <ActivityIndicator size="small" color={ThemeColors.text.strong} />
                      : <Text className="text-pos-sm font-bold text-white">Receive Stock</Text>}
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
