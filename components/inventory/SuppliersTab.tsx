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
import { Building2, ChevronRight, Plus, RefreshCw, Truck, X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import type { Supplier, SupplierFormInput } from '@/hooks/use-suppliers';
import { useSuppliers } from '@/hooks/use-suppliers';

import { EmptyState } from './shared';

// ─── SupplierFormModal ────────────────────────────────────────────────────────

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

// ─── SuppliersTab ─────────────────────────────────────────────────────────────

export function SuppliersTab() {
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
