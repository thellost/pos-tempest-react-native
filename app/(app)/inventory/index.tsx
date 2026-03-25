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
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react-native';

import { PURCHASE_STATUS, UNIT_OF_MEASURE } from '@/constants/enums';
import type { PurchaseStatus, UnitOfMeasure } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { powersync } from '@/db/provider';
import type { AdjustmentType, InventoryItem, InventoryMovement } from '@/hooks/use-inventory';
import { useInventory } from '@/hooks/use-inventory';
import type { CreatePurchaseInput, CreatePurchaseItem, Purchase } from '@/hooks/use-purchases';
import { usePurchases } from '@/hooks/use-purchases';
import type { Supplier, SupplierFormInput } from '@/hooks/use-suppliers';
import { useSuppliers } from '@/hooks/use-suppliers';
import { formatIDR } from '@/utils/currency';

// ─── helpers ────────────────────────────────────────────────────────────────

type InventoryTab = 'stock' | 'purchases' | 'suppliers';

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

function formatQty(qty: number) {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/\.?0+$/, '');
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, onRefresh, refreshing }: { title: string; onRefresh: () => void; refreshing: boolean }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-3">
      <Text className="text-pos-xl font-bold text-pos-text">{title}</Text>
      <Pressable onPress={onRefresh} disabled={refreshing} hitSlop={8} className="p-1">
        {refreshing
          ? <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
          : <RefreshCw size={18} color={ThemeColors.text.muted} />}
      </Pressable>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <View className="items-center justify-center py-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
        {icon}
      </View>
      <Text className="text-pos-base text-pos-text-muted">{message}</Text>
    </View>
  );
}

// ─── stock tab ───────────────────────────────────────────────────────────────

interface StockDetailModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onAdjust: (inventoryId: number, qty: number, type: AdjustmentType, reason: string) => Promise<void>;
  onThreshold: (inventoryId: number, threshold: number) => Promise<InventoryItem>;
  getMovements: (inventoryId: number) => Promise<InventoryMovement[]>;
}

function StockDetailModal({ item, onClose, onAdjust, onThreshold, getMovements }: StockDetailModalProps) {
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
      // Refresh movements
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

            {/* Modal header */}
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

              {/* Adjust stock */}
              <View>
                <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Adjust Stock</Text>
                {/* Type picker */}
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

function StockTab() {
  const { items, isLoading, error, fetchInventory, adjustStock, updateThreshold, getMovements } = useInventory();
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const filtered = items.filter((i) => {
    if (lowOnly && !i.is_low_stock) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <View className="flex-1">
      <SectionHeader title="Stock Levels" onRefresh={fetchInventory} refreshing={isLoading} />

      {/* Search + filter bar */}
      <View className="flex-row items-center gap-2 border-b border-border bg-surface-card px-4 py-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search ingredient name..."
          placeholderTextColor={ThemeColors.text.faint}
          className="flex-1 rounded-sm border border-border bg-surface-raised px-3 text-pos-sm text-pos-text"
          style={{ height: 36 }}
        />
        <Pressable
          onPress={() => setLowOnly((v) => !v)}
          className="flex-row items-center gap-1 rounded-sm px-3"
          style={{
            height: 36,
            backgroundColor: lowOnly ? ThemeColors.danger.badge : ThemeColors.surfaces.raised,
          }}
        >
          <AlertTriangle size={13} color={lowOnly ? ThemeColors.danger.DEFAULT : ThemeColors.text.muted} />
          <Text
            className="text-pos-xs font-bold"
            style={{ color: lowOnly ? ThemeColors.danger.DEFAULT : ThemeColors.text.muted }}
          >
            Low Stock
          </Text>
        </Pressable>
      </View>

      {isLoading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-pos-base text-pos-text-muted">{error}</Text>
          <Pressable onPress={fetchInventory} className="mt-4 rounded-sm px-4 py-2" style={{ backgroundColor: ThemeColors.accent.primaryMuted }}>
            <Text className="text-pos-sm font-bold" style={{ color: ThemeColors.accent.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 6 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <EmptyState icon={<Package size={32} color={ThemeColors.text.muted} />} message="No inventory items" />
          ) : (
            filtered.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelected(item)}
                className="flex-row items-center gap-3 rounded-sm border border-border bg-surface-card px-4 py-3"
              >
                <View className="flex-1">
                  <Text className="text-pos-base font-semibold text-pos-text">{item.name}</Text>
                  <Text className="text-pos-xs font-mono text-pos-text-faint">{item.unit_of_measure}</Text>
                </View>

                <View className="items-end gap-1">
                  <Text className="font-mono text-pos-lg font-bold text-pos-text">{formatQty(item.stock_quantity)}</Text>
                  <Text className="text-pos-xs text-pos-text-faint">
                    threshold: {formatQty(item.low_stock_threshold)}
                  </Text>
                </View>

                {item.is_low_stock && (
                  <View className="rounded-sm px-2 py-1" style={{ backgroundColor: ThemeColors.danger.badge }}>
                    <Text className="text-pos-xs font-bold" style={{ color: ThemeColors.danger.DEFAULT }}>Low</Text>
                  </View>
                )}

                <ChevronRight size={16} color={ThemeColors.text.faint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <StockDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onAdjust={async (id, qty, type, reason) => {
          await adjustStock({ inventory_id: id, quantity_change: qty, movement_type: type, reason });
        }}
        onThreshold={updateThreshold}
        getMovements={getMovements}
      />
    </View>
  );
}

// ─── purchases tab ───────────────────────────────────────────────────────────

interface InventoryRow { id: number; name: string; unit_of_measure: string }

async function searchInventory(query: string): Promise<InventoryRow[]> {
  if (!query.trim()) return [];
  return powersync.getAll<InventoryRow>(
    `SELECT id, name, unit_of_measure FROM inventories WHERE name LIKE ? LIMIT 12`,
    [`%${query}%`],
  );
}

interface CreatePOModalProps {
  visible: boolean;
  suppliers: Supplier[];
  branchId: number;
  onClose: () => void;
  onCreate: (input: CreatePurchaseInput) => Promise<Purchase>;
}

// Draft item uses raw strings for number inputs to avoid NaN in controlled TextInput
interface DraftPOItem {
  inventory_id: number;
  inventory_name: string;
  quantity: string;
  unit_of_measure: UnitOfMeasure;
  cost_per_unit: string;
}

// ─── UOM Dropdown ─────────────────────────────────────────────────────────────
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

function CreatePOModal({ visible, suppliers, branchId, onClose, onCreate }: CreatePOModalProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [tax, setTax] = useState('');
  const [items, setItems] = useState<DraftPOItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Filtered supplier list
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

  // Running totals
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

            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border px-5 py-4 bg-surface-raised">
              <Text className="text-pos-xl font-bold text-pos-text">New Purchase Order</Text>
              <Pressable onPress={onClose} hitSlop={8} className="p-1">
                <X size={22} color={ThemeColors.text.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">

              {/* ── Supplier search ── */}
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

              {/* ── Notes + Tax ── */}
              <View className="flex-row gap-4">
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
                <View style={{ width: 160 }}>
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

              {/* ── Add item search ── */}
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

              {/* ── Item list ── */}
              {items.length > 0 && (
                <View className="gap-3">
                  <Text className="text-pos-sm font-semibold text-pos-text-muted">
                    Items ({items.length})
                  </Text>
                  {items.map((it, idx) => {
                    const lineTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.cost_per_unit) || 0);
                    return (
                      <View key={idx} className="rounded-sm border border-border bg-surface-raised p-4 gap-3">
                        {/* Item name + remove */}
                        <View className="flex-row items-center justify-between">
                          <Text className="flex-1 text-pos-lg font-bold text-pos-text">{it.inventory_name}</Text>
                          <Pressable onPress={() => removeItem(idx)} hitSlop={8} className="ml-2">
                            <X size={18} color={ThemeColors.danger.DEFAULT} />
                          </Pressable>
                        </View>

                        {/* Qty / Unit / Cost row */}
                        <View className="flex-row gap-3">
                          {/* Qty */}
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
                          {/* Unit dropdown */}
                          <View style={{ width: 90 }}>
                            <Text className="mb-1 text-pos-sm text-pos-text-muted">Unit</Text>
                            <UomDropdown
                              value={it.unit_of_measure}
                              onChange={(u) => updateItem(idx, 'unit_of_measure', u)}
                            />
                          </View>
                          {/* Cost */}
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

                        {/* Line total */}
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

                  {/* ── PO Total summary ── */}
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

            {/* Footer */}
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

          {/* Header */}
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

                {/* Received banner */}
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

                {/* Meta */}
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

                {/* Items */}
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

function PurchasesTab() {
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

      {/* Status filter */}
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

// ─── suppliers tab ───────────────────────────────────────────────────────────

interface SupplierFormModalProps {
  visible: boolean;
  editing: Supplier | null;
  onClose: () => void;
  onSave: (input: SupplierFormInput) => Promise<void>;
}

function SupplierFormModal({ visible, editing, onClose, onSave }: SupplierFormModalProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setContact(editing.contact_person ?? '');
      setPhone(editing.phone ?? '');
      setEmail(editing.email ?? '');
      setAddress(editing.address ?? '');
    } else {
      setName(''); setContact(''); setPhone(''); setEmail(''); setAddress('');
    }
  }, [editing, visible]);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name Required', 'Enter a supplier name.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        contact_person: contact || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
      });
      onClose();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: ThemeColors.surfaces.overlay }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: 480, maxWidth: '92%' }}>
          <View className="rounded-lg bg-surface-card border border-border overflow-hidden">

            <View className="flex-row items-center justify-between border-b border-border px-4 py-3 bg-surface-raised">
              <Text className="text-pos-lg font-bold text-pos-text">{editing ? 'Edit Supplier' : 'New Supplier'}</Text>
              <Pressable onPress={onClose} hitSlop={8} className="p-1">
                <X size={20} color={ThemeColors.text.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
              {([
                { label: 'Name *', value: name, onChange: setName, placeholder: 'e.g. PT Sumber Pangan' },
                { label: 'Contact Person', value: contact, onChange: setContact, placeholder: 'PIC name' },
                { label: 'Phone', value: phone, onChange: setPhone, placeholder: '021-...' },
                { label: 'Email', value: email, onChange: setEmail, placeholder: 'email@supplier.com' },
                { label: 'Address', value: address, onChange: setAddress, placeholder: 'Street address' },
              ]).map((field) => (
                <View key={field.label}>
                  <Text className="mb-1 text-pos-xs font-semibold text-pos-text-muted">{field.label}</Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={field.placeholder}
                    placeholderTextColor={ThemeColors.text.faint}
                    className="rounded-sm border border-border bg-surface-raised px-3 text-pos-sm text-pos-text"
                    style={{ height: 40 }}
                  />
                </View>
              ))}
            </ScrollView>

            <View className="flex-row gap-2 border-t border-border px-4 py-3 bg-surface-raised">
              <Pressable onPress={onClose} className="flex-1 items-center justify-center rounded-sm bg-surface-elevated" style={{ height: 44 }}>
                <Text className="text-pos-base font-semibold text-pos-text-muted">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="flex-1 items-center justify-center rounded-sm"
                style={{ height: 44, backgroundColor: saving ? ThemeColors.surfaces.disabled : ThemeColors.accent.primary }}
              >
                {saving
                  ? <ActivityIndicator size="small" color={ThemeColors.text.strong} />
                  : <Text className="text-pos-base font-bold text-white">{editing ? 'Save Changes' : 'Add Supplier'}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SuppliersTab() {
  const { suppliers, isLoading, error, fetchSuppliers, createSupplier, updateSupplier } = useSuppliers();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(s: Supplier) { setEditing(s); setShowForm(true); }

  async function handleSave(input: SupplierFormInput) {
    if (editing) {
      await updateSupplier(editing.id, input);
    } else {
      await createSupplier(input);
    }
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-3">
        <Text className="text-pos-xl font-bold text-pos-text">Suppliers</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={fetchSuppliers} disabled={isLoading} hitSlop={8} className="p-1">
            {isLoading
              ? <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
              : <RefreshCw size={18} color={ThemeColors.text.muted} />}
          </Pressable>
          <Pressable
            onPress={openCreate}
            className="flex-row items-center gap-1 rounded-sm px-3"
            style={{ height: 32, backgroundColor: ThemeColors.accent.primary }}
          >
            <Plus size={14} color={ThemeColors.text.strong} />
            <Text className="text-pos-xs font-bold text-white">Add Supplier</Text>
          </Pressable>
        </View>
      </View>

      {isLoading && suppliers.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-pos-base text-pos-text-muted">{error}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, gap: 6 }} showsVerticalScrollIndicator={false}>
          {suppliers.length === 0 ? (
            <EmptyState icon={<Building2 size={32} color={ThemeColors.text.muted} />} message="No suppliers yet" />
          ) : (
            suppliers.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => openEdit(s)}
                className="flex-row items-center gap-3 rounded-sm border border-border bg-surface-card px-4 py-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface-raised">
                  <Truck size={18} color={ThemeColors.text.muted} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-pos-base font-semibold text-pos-text">{s.name}</Text>
                    {!s.is_active && (
                      <View className="rounded-sm px-1.5 py-0.5 bg-surface-raised">
                        <Text className="text-pos-xs text-pos-text-faint">Inactive</Text>
                      </View>
                    )}
                  </View>
                  {s.contact_person ? <Text className="text-pos-xs text-pos-text-muted">{s.contact_person}</Text> : null}
                  {s.phone ? <Text className="font-mono text-pos-xs text-pos-text-faint">{s.phone}</Text> : null}
                </View>
                <ChevronRight size={16} color={ThemeColors.text.faint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <SupplierFormModal
        visible={showForm}
        editing={editing}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
      />
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

const TABS: { key: InventoryTab; label: string }[] = [
  { key: 'stock', label: 'Stock' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'suppliers', label: 'Suppliers' },
];

export default function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');

  return (
    <View className="flex-1 bg-surface">

      {/* Tab bar */}
      <View className="flex-row border-b border-border bg-surface-card">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const iconColor = isActive ? ThemeColors.accent.primary : ThemeColors.text.muted;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 flex-row items-center justify-center gap-2 py-3"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: isActive ? ThemeColors.accent.primary : 'transparent',
              }}
            >
              {tab.key === 'stock' && <Package size={16} color={iconColor} />}
              {tab.key === 'purchases' && <ShoppingCart size={16} color={iconColor} />}
              {tab.key === 'suppliers' && <Truck size={16} color={iconColor} />}
              <Text
                className="text-pos-sm font-bold"
                style={{ color: iconColor }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === 'stock' && <StockTab />}
      {activeTab === 'purchases' && <PurchasesTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
    </View>
  );
}
