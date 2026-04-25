import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';

import { PERMISSION } from '@/constants/permissions';
import { ThemeColors } from '@/constants/theme';
import type { AdjustmentType, InventoryItem, InventoryMovement } from '@/hooks/use-inventory';
import { PermissionGate } from '@/components/ui/PermissionGate';

import { formatQty } from './shared';

// ─── constants ───────────────────────────────────────────────────────────────

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string }[] = [
  { value: 'adjustment', label: 'Count Correction' },
  { value: 'waste', label: 'Waste / Spoilage' },
  { value: 'transfer', label: 'Transfer' },
];

const MOVEMENT_LABELS: Record<string, string> = {
  sale_out: 'Sale Deduction',
  purchase_in: 'Purchase Received',
  adjustment: 'Count Correction',
  waste: 'Waste',
  transfer: 'Transfer',
};

// ─── StockDetailModal ─────────────────────────────────────────────────────────

export interface StockDetailModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onAdjust: (inventoryId: number, qty: number, type: AdjustmentType, reason: string) => Promise<void>;
  onThreshold: (inventoryId: number, threshold: number) => Promise<void>;
  getMovements: (inventoryId: number) => Promise<InventoryMovement[]>;
}

export function StockDetailModal({ item, onClose, onAdjust, onThreshold, getMovements }: StockDetailModalProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<AdjustmentType>('adjustment');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const [newThreshold, setNewThreshold] = useState('');
  const [savingThreshold, setSavingThreshold] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNewThreshold(String(item.low_stock_threshold));
    setMovementsLoading(true);
    getMovements(item.id)
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setMovementsLoading(false));
  }, [item, getMovements]);

  if (!item) return null;

  async function handleAdjust() {
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty === 0) {
      Alert.alert('Invalid Quantity', 'Enter a non-zero quantity. Use negative to remove stock.');
      return;
    }
    setAdjusting(true);
    try {
      await onAdjust(item!.id, qty, adjustType, adjustReason);
      setAdjustQty('');
      setAdjustReason('');
      const updated = await getMovements(item!.id);
      setMovements(updated);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  }

  async function handleThreshold() {
    const val = parseFloat(newThreshold);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Threshold', 'Enter a non-negative number.');
      return;
    }
    setSavingThreshold(true);
    try {
      await onThreshold(item!.id, val);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update threshold');
    } finally {
      setSavingThreshold(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: 560, maxWidth: '92%' }}>
          <View className="rounded-lg bg-surface-card border border-border overflow-hidden" style={{ maxHeight: 620 }}>

            <View className="flex-row items-center justify-between border-b border-border px-4 py-3 bg-surface-raised">
              <View className="flex-1">
                <Text className="text-pos-lg font-bold text-pos-text">{item.name}</Text>
                <Text className="text-pos-xs text-pos-text-faint font-mono">{item.unit_of_measure}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8} className="p-1">
                <X size={20} color={ThemeColors.text.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">

              {/* Current stock row */}
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-sm bg-surface-raised px-3 py-2 items-center">
                  <Text className="text-pos-xs text-pos-text-faint">Stock</Text>
                  <Text className="font-mono text-pos-2xl font-bold text-pos-text">{formatQty(item.stock_quantity)}</Text>
                </View>
                <View
                  className="flex-1 rounded-sm px-3 py-2 items-center"
                  style={{ backgroundColor: item.is_low_stock ? ThemeColors.danger.badge : ThemeColors.surfaces.raised }}
                >
                  <Text className="text-pos-xs text-pos-text-faint">Threshold</Text>
                  <Text
                    className="font-mono text-pos-2xl font-bold"
                    style={{ color: item.is_low_stock ? ThemeColors.danger.DEFAULT : ThemeColors.text.primary }}
                  >
                    {formatQty(item.low_stock_threshold)}
                  </Text>
                </View>
                {item.is_low_stock && (
                  <View className="justify-center px-2">
                    <View className="flex-row items-center gap-1 rounded-sm px-2 py-1" style={{ backgroundColor: ThemeColors.danger.badge }}>
                      <AlertTriangle size={12} color={ThemeColors.danger.DEFAULT} />
                      <Text className="text-pos-xs font-bold" style={{ color: ThemeColors.danger.DEFAULT }}>Low Stock</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Update threshold */}
              <PermissionGate permission={PERMISSION.ADJUST_STOCK}>
                <View>
                  <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Update Threshold</Text>
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={newThreshold}
                      onChangeText={setNewThreshold}
                      keyboardType="decimal-pad"
                      placeholder="Threshold qty"
                      placeholderTextColor={ThemeColors.text.faint}
                      className="flex-1 rounded-sm border border-border bg-surface-raised px-3 text-pos-base text-pos-text font-mono"
                      style={{ height: 40 }}
                    />
                    <Pressable
                      onPress={handleThreshold}
                      disabled={savingThreshold}
                      className="rounded-sm px-4"
                      style={{ height: 40, justifyContent: 'center', backgroundColor: ThemeColors.accent.primaryMuted }}
                    >
                      {savingThreshold
                        ? <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
                        : <Text className="text-pos-sm font-bold" style={{ color: ThemeColors.accent.primary }}>Save</Text>}
                    </Pressable>
                  </View>
                </View>
              </PermissionGate>

              {/* Adjust stock */}
              <PermissionGate permission={PERMISSION.ADJUST_STOCK}>
                <View>
                  <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Adjust Stock</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                    {ADJUSTMENT_TYPES.map((t) => (
                      <Pressable
                        key={t.value}
                        onPress={() => setAdjustType(t.value)}
                        className="rounded-sm px-3 py-1"
                        style={{ backgroundColor: adjustType === t.value ? ThemeColors.accent.primary : ThemeColors.surfaces.raised }}
                      >
                        <Text
                          className="text-pos-xs font-bold"
                          style={{ color: adjustType === t.value ? ThemeColors.text.strong : ThemeColors.text.muted }}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View className="gap-2">
                    <TextInput
                      value={adjustQty}
                      onChangeText={setAdjustQty}
                      keyboardType="decimal-pad"
                      placeholder="Qty change (e.g. -5 to remove, 20 to add)"
                      placeholderTextColor={ThemeColors.text.faint}
                      className="rounded-sm border border-border bg-surface-raised px-3 text-pos-base text-pos-text font-mono"
                      style={{ height: 40 }}
                    />
                    <TextInput
                      value={adjustReason}
                      onChangeText={setAdjustReason}
                      placeholder="Reason (optional)"
                      placeholderTextColor={ThemeColors.text.faint}
                      className="rounded-sm border border-border bg-surface-raised px-3 text-pos-base text-pos-text"
                      style={{ height: 40 }}
                    />
                    <Pressable
                      onPress={handleAdjust}
                      disabled={adjusting || !adjustQty}
                      className="rounded-sm items-center justify-center"
                      style={{ height: 42, backgroundColor: adjusting ? ThemeColors.surfaces.disabled : ThemeColors.accent.primary }}
                    >
                      {adjusting
                        ? <ActivityIndicator size="small" color={ThemeColors.text.strong} />
                        : <Text className="text-pos-base font-bold text-white">Apply Adjustment</Text>}
                    </Pressable>
                  </View>
                </View>
              </PermissionGate>

              {/* Movement history */}
              <View>
                <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Movement History</Text>
                {movementsLoading
                  ? <ActivityIndicator color={ThemeColors.accent.primary} />
                  : movements.length === 0
                    ? <Text className="text-pos-xs text-pos-text-faint">No movements recorded.</Text>
                    : movements.map((m) => (
                      <View key={m.id} className="mb-2 flex-row items-start gap-2 rounded-sm bg-surface-raised px-3 py-2">
                        <View className="flex-1">
                          <Text className="text-pos-xs font-semibold text-pos-text">
                            {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                          </Text>
                          <Text className="text-pos-xs text-pos-text-faint">
                            {m.quantity_before} → {m.quantity_after}
                            {m.user_name ? `  ·  ${m.user_name}` : ''}
                          </Text>
                          {m.reason ? <Text className="text-pos-xs text-pos-text-faint">{m.reason}</Text> : null}
                        </View>
                        <Text
                          className="font-mono text-pos-sm font-bold"
                          style={{ color: m.quantity_change >= 0 ? ThemeColors.success.DEFAULT : ThemeColors.danger.DEFAULT }}
                        >
                          {m.quantity_change >= 0 ? '+' : ''}{formatQty(m.quantity_change)}
                        </Text>
                      </View>
                    ))}
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
