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
import { ChevronRight, Plus, RefreshCw, ShoppingCart, Truck, X } from 'lucide-react-native';

import { PURCHASE_STATUS, UNIT_OF_MEASURE } from '@/constants/enums';
import type { PurchaseStatus, UnitOfMeasure } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { powersync } from '@/db/provider';
import type { CreatePurchaseInput, CreatePurchaseItem, Purchase } from '@/hooks/use-purchases';
import { usePurchases } from '@/hooks/use-purchases';
import type { Supplier } from '@/hooks/use-suppliers';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useLayout } from '@/hooks/use-layout';
import { formatIDR } from '@/utils/currency';

import { EmptyState, formatQty } from './shared';

// ─── constants ───────────────────────────────────────────────────────────────

const PURCHASE_STATUS_TABS: { key: 'all' | PurchaseStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: PURCHASE_STATUS.ORDERED, label: 'Ordered' },
  { key: PURCHASE_STATUS.PARTIAL_RECEIVED, label: 'Partial' },
  { key: PURCHASE_STATUS.RECEIVED, label: 'Received' },
  { key: PURCHASE_STATUS.CANCELLED, label: 'Cancelled' },
];

const UOM_OPTIONS: UnitOfMeasure[] = Object.values(UNIT_OF_MEASURE);
const UOM_LABELS: Record<UnitOfMeasure, string> = {
  piece: 'pcs', kg: 'kg', gram: 'g', ons: 'ons', liter: 'L', ml: 'ml', portion: 'ptn',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function purchaseStatusColor(status: PurchaseStatus) {
  switch (status) {
    case PURCHASE_STATUS.ORDERED: return ThemeColors.warning.DEFAULT;
    case PURCHASE_STATUS.PARTIAL_RECEIVED: return ThemeColors.accent.primary;
    case PURCHASE_STATUS.RECEIVED: return ThemeColors.success.DEFAULT;
    case PURCHASE_STATUS.CANCELLED: return ThemeColors.text.faint;
    default: return ThemeColors.text.muted;
  }
}

function purchaseStatusBg(status: PurchaseStatus) {
  switch (status) {
    case PURCHASE_STATUS.ORDERED: return ThemeColors.warning.badge;
    case PURCHASE_STATUS.PARTIAL_RECEIVED: return ThemeColors.accent.primaryBadge;
    case PURCHASE_STATUS.RECEIVED: return ThemeColors.success.muted;
    case PURCHASE_STATUS.CANCELLED: return ThemeColors.surfaces.raised;
    default: return ThemeColors.surfaces.raised;
  }
}

function purchaseStatusLabel(status: PurchaseStatus) {
  switch (status) {
    case PURCHASE_STATUS.ORDERED: return 'Ordered';
    case PURCHASE_STATUS.PARTIAL_RECEIVED: return 'Partial';
    case PURCHASE_STATUS.RECEIVED: return 'Received';
    case PURCHASE_STATUS.CANCELLED: return 'Cancelled';
    default: return status;
  }
}

// ─── types ────────────────────────────────────────────────────────────────────

interface InventoryRow { id: number; name: string; unit_of_measure: string }

// Draft item uses raw strings for number inputs to avoid NaN in controlled TextInput
interface DraftPOItem {
  inventory_id: number;
  inventory_name: string;
  quantity: string;
  unit_of_measure: UnitOfMeasure;
  cost_per_unit: string;
}

// ─── searchInventory ──────────────────────────────────────────────────────────

async function searchInventory(query: string): Promise<InventoryRow[]> {
  if (!query.trim()) return [];
  return powersync.getAll<InventoryRow>(
    `SELECT id, name, unit_of_measure FROM inventories WHERE name LIKE ? LIMIT 12`,
    [`%${query}%`],
  );
}

// ─── UomDropdown ──────────────────────────────────────────────────────────────

function UomDropdown({ value, onChange }: { value: UnitOfMeasure; onChange: (u: UnitOfMeasure) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-sm border border-border bg-surface px-3"
        style={{ height: 48 }}
      >
        <Text className="text-pos-base font-bold text-pos-text">{UOM_LABELS[value]}</Text>
        <Text className="text-pos-xs text-pos-text-faint">▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: ThemeColors.surfaces.overlay }}
          onPress={() => setOpen(false)}
        >
          <View className="rounded-lg border border-border bg-surface-card overflow-hidden" style={{ width: 200 }}>
            {UOM_OPTIONS.map((u) => (
              <Pressable
                key={u}
                onPress={() => { onChange(u); setOpen(false); }}
                className="flex-row items-center justify-between border-b border-border px-4 py-3"
                style={{ backgroundColor: value === u ? ThemeColors.accent.primaryMuted : 'transparent' }}
              >
                <Text
                  className="text-pos-base font-semibold"
                  style={{ color: value === u ? ThemeColors.accent.primary : ThemeColors.text.primary }}
                >
                  {UOM_LABELS[u]}
                </Text>
                <Text className="text-pos-xs text-pos-text-faint">{u}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── CreatePOModal ────────────────────────────────────────────────────────────

interface CreatePOModalProps {
  visible: boolean;
  suppliers: Supplier[];
  branchId: number;
  onClose: () => void;
  onCreate: (input: CreatePurchaseInput) => Promise<Purchase>;
}

function CreatePOModal({ visible, suppliers, branchId, onClose, onCreate }: CreatePOModalProps) {
  const { isPhone } = useLayout();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [tax, setTax] = useState('');
  const [items, setItems] = useState<DraftPOItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const supplierResults = supplierSearch.trim()
    ? suppliers.filter((s) => s.is_active && s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    : [];

  useEffect(() => {
    if (!itemSearch.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchInventory(itemSearch)
      .then(setSearchResults)
      .finally(() => setSearchLoading(false));
  }, [itemSearch]);

  const subtotal = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const cost = parseFloat(it.cost_per_unit) || 0;
    return sum + qty * cost;
  }, 0);
  const taxAmount = parseFloat(tax) || 0;
  const total = subtotal + taxAmount;

  function addItem(inv: InventoryRow) {
    setItems((prev) => [
      ...prev,
      { inventory_id: Number(inv.id), inventory_name: inv.name, quantity: '1', unit_of_measure: inv.unit_of_measure as UnitOfMeasure, cost_per_unit: '' },
    ]);
    setItemSearch('');
    setSearchResults([]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof DraftPOItem, value: string | UnitOfMeasure) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function reset() {
    setSelectedSupplier(null);
    setSupplierSearch('');
    setNotes('');
    setTax('');
    setItems([]);
    setItemSearch('');
    setSearchResults([]);
  }

  async function handleCreate() {
    if (!selectedSupplier) { Alert.alert('Select Supplier', 'Please select a supplier.'); return; }
    if (items.length === 0) { Alert.alert('Add Items', 'Add at least one item to the PO.'); return; }

    const parsed = items.map((it) => ({
      inventory_id: parseInt(String(it.inventory_id), 10),
      unit_of_measure: it.unit_of_measure,
      quantity: parseFloat(it.quantity),
      cost_per_unit: parseFloat(it.cost_per_unit),
    }));

    const hasInvalidQty = parsed.some((it) => isNaN(it.quantity) || it.quantity <= 0);
    const hasInvalidCost = parsed.some((it) => isNaN(it.cost_per_unit) || it.cost_per_unit <= 0);
    if (hasInvalidQty) { Alert.alert('Invalid Quantity', 'All quantities must be greater than 0.'); return; }
    if (hasInvalidCost) { Alert.alert('Invalid Cost', 'All cost per unit values must be greater than 0.'); return; }

    setSaving(true);
    try {
      await onCreate({
        supplier_id: selectedSupplier.id,
        branch_id: branchId,
        notes: notes || undefined,
        tax_amount: taxAmount > 0 ? taxAmount : undefined,
        items: parsed,
      });
      reset();
      onClose();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: 680, maxWidth: '96%' }}>
          <View className="rounded-lg bg-surface-card border border-border overflow-hidden" style={{ maxHeight: 720 }}>

            <View className="flex-row items-center justify-between border-b border-border px-5 py-4 bg-surface-raised">
              <Text className="text-pos-xl font-bold text-pos-text">New Purchase Order</Text>
              <Pressable onPress={onClose} hitSlop={8} className="p-1">
                <X size={22} color={ThemeColors.text.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">

              {/* Supplier search */}
              <View>
                <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Supplier *</Text>
                {selectedSupplier ? (
                  <View
                    className="flex-row items-center gap-3 rounded-sm border px-4"
                    style={{ height: 52, borderColor: ThemeColors.accent.primaryBorder, backgroundColor: ThemeColors.accent.primaryMuted }}
                  >
                    <Truck size={18} color={ThemeColors.accent.primary} />
                    <Text className="flex-1 text-pos-base font-bold" style={{ color: ThemeColors.accent.primary }}>
                      {selectedSupplier.name}
                    </Text>
                    <Pressable onPress={() => { setSelectedSupplier(null); setSupplierSearch(''); }} hitSlop={8}>
                      <X size={18} color={ThemeColors.accent.primary} />
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <TextInput
                      value={supplierSearch}
                      onChangeText={setSupplierSearch}
                      placeholder="Search supplier by name..."
                      placeholderTextColor={ThemeColors.text.faint}
                      className="rounded-sm border border-border bg-surface-raised px-4 text-pos-base text-pos-text"
                      style={{ height: 52 }}
                      autoFocus={false}
                    />
                    {supplierResults.length > 0 && (
                      <View className="mt-1 rounded-sm border border-border bg-surface-raised overflow-hidden">
                        {supplierResults.map((s) => (
                          <Pressable
                            key={s.id}
                            onPress={() => { setSelectedSupplier(s); setSupplierSearch(''); }}
                            className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                          >
                            <Truck size={16} color={ThemeColors.text.muted} />
                            <View className="flex-1">
                              <Text className="text-pos-base font-semibold text-pos-text">{s.name}</Text>
                              {s.contact_person ? <Text className="text-pos-xs text-pos-text-faint">{s.contact_person}</Text> : null}
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {supplierSearch.trim().length > 0 && supplierResults.length === 0 && (
                      <Text className="mt-2 text-pos-sm text-pos-text-faint">No suppliers match "{supplierSearch}"</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Notes + Tax */}
              <View className={isPhone ? 'gap-3' : 'flex-row gap-4'}>
                <View className="flex-1">
                  <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional notes..."
                    placeholderTextColor={ThemeColors.text.faint}
                    className="rounded-sm border border-border bg-surface-raised px-4 text-pos-base text-pos-text"
                    style={{ height: 52 }}
                  />
                </View>
                <View style={isPhone ? undefined : { width: 160 }}>
                  <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Tax (Rp)</Text>
                  <TextInput
                    value={tax}
                    onChangeText={setTax}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={ThemeColors.text.faint}
                    className="rounded-sm border border-border bg-surface-raised px-4 font-mono text-pos-base text-pos-text"
                    style={{ height: 52 }}
                  />
                </View>
              </View>

              {/* Add item search */}
              <View>
                <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Add Items *</Text>
                <TextInput
                  value={itemSearch}
                  onChangeText={setItemSearch}
                  placeholder="Search ingredient by name..."
                  placeholderTextColor={ThemeColors.text.faint}
                  className="rounded-sm border border-border bg-surface-raised px-4 text-pos-base text-pos-text"
                  style={{ height: 52 }}
                />
                {searchLoading && <ActivityIndicator size="small" color={ThemeColors.accent.primary} style={{ marginTop: 6 }} />}
                {searchResults.length > 0 && (
                  <View className="mt-1 rounded-sm border border-border bg-surface-raised overflow-hidden">
                    {searchResults.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => addItem(r)}
                        className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                      >
                        <Plus size={16} color={ThemeColors.accent.primary} />
                        <Text className="flex-1 text-pos-base text-pos-text">{r.name}</Text>
                        <Text className="font-mono text-pos-sm text-pos-text-faint">{r.unit_of_measure}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Item list */}
              {items.length > 0 && (
                <View className="gap-3">
                  <Text className="text-pos-sm font-semibold text-pos-text-muted">
                    Items ({items.length})
                  </Text>
                  {items.map((it, idx) => {
                    const lineTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.cost_per_unit) || 0);
                    return (
                      <View key={idx} className="rounded-sm border border-border bg-surface-raised p-4 gap-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="flex-1 text-pos-lg font-bold text-pos-text">{it.inventory_name}</Text>
                          <Pressable onPress={() => removeItem(idx)} hitSlop={8} className="ml-2">
                            <X size={18} color={ThemeColors.danger.DEFAULT} />
                          </Pressable>
                        </View>

                        <View className={isPhone ? 'gap-3' : 'flex-row gap-3'}>
                          <View className="flex-1">
                            <Text className="mb-1 text-pos-sm text-pos-text-muted">Quantity</Text>
                            <TextInput
                              value={it.quantity}
                              onChangeText={(v) => updateItem(idx, 'quantity', v)}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={ThemeColors.text.faint}
                              className="rounded-sm border border-border bg-surface px-3 font-mono text-pos-lg font-bold text-pos-text"
                              style={{ height: 52 }}
                            />
                          </View>
                          <View style={isPhone ? undefined : { width: 90 }}>
                            <Text className="mb-1 text-pos-sm text-pos-text-muted">Unit</Text>
                            <UomDropdown
                              value={it.unit_of_measure}
                              onChange={(u) => updateItem(idx, 'unit_of_measure', u)}
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="mb-1 text-pos-sm text-pos-text-muted">Cost / unit (Rp)</Text>
                            <TextInput
                              value={it.cost_per_unit}
                              onChangeText={(v) => updateItem(idx, 'cost_per_unit', v)}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={ThemeColors.text.faint}
                              className="rounded-sm border border-border bg-surface px-3 font-mono text-pos-lg font-bold text-pos-text"
                              style={{ height: 52 }}
                            />
                          </View>
                        </View>

                        {lineTotal > 0 && (
                          <View className="flex-row items-center justify-end gap-2">
                            <Text className="text-pos-sm text-pos-text-faint">Line total:</Text>
                            <Text className="font-mono text-pos-base font-bold text-pos-text">
                              {formatIDR(lineTotal)}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* PO Total summary */}
                  <View className="rounded-sm border border-border bg-surface-elevated p-4 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-pos-sm text-pos-text-muted">Subtotal</Text>
                      <Text className="font-mono text-pos-base text-pos-text">{formatIDR(subtotal)}</Text>
                    </View>
                    {taxAmount > 0 && (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-pos-sm text-pos-text-muted">Tax</Text>
                        <Text className="font-mono text-pos-base text-pos-text">{formatIDR(taxAmount)}</Text>
                      </View>
                    )}
                    <View className="border-t border-border pt-2 flex-row items-center justify-between">
                      <Text className="text-pos-base font-bold text-pos-text">Total PO</Text>
                      <Text className="font-mono text-pos-xl font-bold" style={{ color: ThemeColors.accent.primary }}>
                        {formatIDR(total)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

            </ScrollView>

            <View className="flex-row gap-3 border-t border-border px-5 py-4 bg-surface-raised">
              <Pressable onPress={onClose} className="flex-1 items-center justify-center rounded-sm bg-surface-elevated" style={{ height: 52 }}>
                <Text className="text-pos-base font-semibold text-pos-text-muted">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={saving}
                className="flex-2 items-center justify-center rounded-sm"
                style={{ flex: 2, height: 52, backgroundColor: saving ? ThemeColors.surfaces.disabled : ThemeColors.accent.primary }}
              >
                {saving
                  ? <ActivityIndicator size="small" color={ThemeColors.text.strong} />
                  : (
                    <View className="items-center">
                      <Text className="text-pos-base font-bold text-white">Create Purchase Order</Text>
                      {total > 0 && (
                        <Text className="font-mono text-pos-xs text-white opacity-80">{formatIDR(total)}</Text>
                      )}
                    </View>
                  )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── PODetailModal ────────────────────────────────────────────────────────────

interface PODetailModalProps {
  purchaseId: number | null;
  onClose: () => void;
  onReceive: (id: number, notes?: string) => Promise<Purchase>;
  onCancel: (id: number) => Promise<Purchase>;
  getPurchase: (id: number) => Promise<Purchase>;
}

function PODetailModal({ purchaseId, onClose, onReceive, onCancel, getPurchase }: PODetailModalProps) {
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
              <View className="mr-3 rounded-sm px-2 py-1" style={{ backgroundColor: purchaseStatusBg(purchase.status) }}>
                <Text className="text-pos-xs font-bold" style={{ color: purchaseStatusColor(purchase.status) }}>
                  {purchaseStatusLabel(purchase.status)}
                </Text>
              </View>
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

// ─── PurchasesTab ─────────────────────────────────────────────────────────────

export function PurchasesTab() {
  const { purchases, isLoading, error, fetchPurchases, getPurchase, createPurchase, receivePurchase, cancelPurchase, branchId } = usePurchases();
  const { suppliers } = useSuppliers();

  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    fetchPurchases(statusFilter === 'all' ? undefined : statusFilter);
  }, [statusFilter, fetchPurchases]);

  const filtered = statusFilter === 'all'
    ? purchases
    : purchases.filter((p) => p.status === statusFilter);

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-3">
        <Text className="text-pos-xl font-bold text-pos-text">Purchase Orders</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => fetchPurchases(statusFilter === 'all' ? undefined : statusFilter)}
            disabled={isLoading}
            hitSlop={8}
            className="p-1"
          >
            {isLoading
              ? <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
              : <RefreshCw size={18} color={ThemeColors.text.muted} />}
          </Pressable>
          <Pressable
            onPress={() => setShowCreate(true)}
            className="flex-row items-center gap-1 rounded-sm px-3"
            style={{ height: 32, backgroundColor: ThemeColors.accent.primary }}
          >
            <Plus size={14} color={ThemeColors.text.strong} />
            <Text className="text-pos-xs font-bold text-white">New PO</Text>
          </Pressable>
        </View>
      </View>

      <View className="border-b border-border bg-surface-card" style={{ height: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
          {PURCHASE_STATUS_TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              className="rounded-sm px-4 py-1"
              style={{ backgroundColor: statusFilter === tab.key ? ThemeColors.accent.primary : ThemeColors.surfaces.raised }}
            >
              <Text
                className="text-pos-xs font-bold"
                style={{ color: statusFilter === tab.key ? ThemeColors.text.strong : ThemeColors.text.muted }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading && purchases.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-pos-base text-pos-text-muted">{error}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 6 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={32} color={ThemeColors.text.muted} />} message="No purchase orders" />
          ) : (
            filtered.map((po) => (
              <Pressable
                key={po.id}
                onPress={() => setDetailId(po.id)}
                className="flex-row items-center gap-3 rounded-sm border border-border bg-surface-card px-4 py-3"
              >
                <View className="flex-1">
                  <Text className="font-mono text-pos-base font-bold text-pos-text">{po.purchase_number}</Text>
                  <Text className="text-pos-xs text-pos-text-muted">{po.supplier_name}</Text>
                </View>
                <Text className="font-mono text-pos-base font-bold text-pos-text">{formatIDR(po.total)}</Text>
                <View className="rounded-sm px-2 py-1" style={{ backgroundColor: purchaseStatusBg(po.status) }}>
                  <Text className="text-pos-xs font-bold" style={{ color: purchaseStatusColor(po.status) }}>
                    {purchaseStatusLabel(po.status)}
                  </Text>
                </View>
                <ChevronRight size={16} color={ThemeColors.text.faint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <CreatePOModal
        visible={showCreate}
        suppliers={suppliers}
        branchId={branchId}
        onClose={() => setShowCreate(false)}
        onCreate={createPurchase}
      />

      <PODetailModal
        purchaseId={detailId}
        onClose={() => setDetailId(null)}
        onReceive={receivePurchase}
        onCancel={cancelPurchase}
        getPurchase={getPurchase}
      />
    </View>
  );
}
