import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Phone } from 'lucide-react-native';

import { Button } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import type { CreateCustomerInput } from '@/hooks/use-customers';

const PLACEHOLDER_COLOR = ThemeColors.text.faint;
const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

export interface NewCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateCustomerInput) => Promise<void>;
  isLoading: boolean;
}

export function NewCustomerModal({ visible, onClose, onCreate, isLoading }: NewCustomerModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);

  const reset = useCallback(() => setForm(EMPTY_FORM), []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.phone.trim()) {
      Alert.alert('Validation', 'Phone number is required.');
      return;
    }
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Customer name is required.');
      return;
    }
    try {
      await onCreate({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      });
      reset();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to register customer.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl bg-surface-card" style={{ maxHeight: '90%' }}>
            {/* Drag handle */}
            <View className="items-center pt-3 pb-1">
              <View className="h-1 w-10 rounded-full bg-pos-muted/40" />
            </View>

            {/* Header */}
            <View className="px-5 pt-2 pb-4">
              <Text className="text-pos-xl font-bold text-pos-text">Register New Customer</Text>
            </View>

            {/* Scrollable form */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="mb-4">
                <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Full Name *</Text>
                <TextInput
                  value={form.name}
                  onChangeText={name => setForm(p => ({ ...p, name }))}
                  placeholder="Customer name"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                />
              </View>

              <View className="mb-4">
                <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Phone Number *</Text>
                <View className="flex-row items-center rounded-xl border border-brand bg-surface px-4 py-3">
                  <Phone size={16} color={ThemeColors.text.muted} style={{ marginRight: 8 }} />
                  <TextInput
                    value={form.phone}
                    onChangeText={phone => setForm(p => ({ ...p, phone }))}
                    placeholder="e.g. 081234567890"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    keyboardType="phone-pad"
                    className="flex-1 text-pos-base text-pos-text"
                  />
                </View>
                <Text className="mt-1 text-pos-xs text-pos-text-muted">
                  Phone is used as the unique registration identifier.
                </Text>
              </View>

              <View className="mb-4">
                <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                  Email{' '}<Text className="text-pos-text-muted">(optional)</Text>
                </Text>
                <TextInput
                  value={form.email}
                  onChangeText={email => setForm(p => ({ ...p, email }))}
                  placeholder="customer@email.com"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                />
              </View>

              <View className="mb-4">
                <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                  Address{' '}<Text className="text-pos-text-muted">(optional)</Text>
                </Text>
                <TextInput
                  value={form.address}
                  onChangeText={address => setForm(p => ({ ...p, address }))}
                  placeholder="Street address"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                />
              </View>

              <View className="mb-4">
                <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                  Notes{' '}<Text className="text-pos-text-muted">(optional)</Text>
                </Text>
                <TextInput
                  value={form.notes}
                  onChangeText={notes => setForm(p => ({ ...p, notes }))}
                  placeholder="Dietary restrictions, preferences…"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  multiline
                  numberOfLines={3}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              </View>
            </ScrollView>

            {/* Action buttons — sticky at bottom */}
            <View className="flex-row gap-3 px-5 py-4">
              <Button
                onPress={handleClose}
                className="flex-1 items-center rounded-2xl border border-border py-3.5"
              >
                <Text className="text-pos-base font-semibold text-pos-text-muted">Cancel</Text>
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={isLoading}
                className="flex-[2] items-center rounded-2xl bg-brand py-3.5"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-pos-base font-bold text-white">Register</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
