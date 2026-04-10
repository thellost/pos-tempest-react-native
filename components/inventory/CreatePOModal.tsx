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
import { Plus, Truck, X } from 'lucide-react-native';

import type { UnitOfMeasure } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';
import { powersync } from '@/db/provider';
import type { CreatePurchaseInput, Purchase } from '@/hooks/use-purchases';
import type { Supplier } from '@/hooks/use-suppliers';
import { useLayout } from '@/hooks/use-layout';
import { formatIDR } from '@/utils/currency';
import { UomDropdown } from './UomDropdown';

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

// ─── CreatePOModal ────────────────────────────────────────────────────────────

export interface CreatePOModalProps {
  visible: boolean;
  suppliers: Supplier[];
  branchId: number;
  onClose: () => void;
  onCreate: (input: CreatePurchaseInput) => Promise<Purchase>;
}

export function CreatePOModal({ visible, suppliers, branchId, onClose, onCreate }: CreatePOModalProps) {
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
