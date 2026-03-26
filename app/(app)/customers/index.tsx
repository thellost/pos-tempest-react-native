import { useCallback, useEffect, useState } from 'react';
import { toInt } from '@/utils/coerce';
import { Mail, Phone, Search, Star, User, Users, X } from 'lucide-react-native';
import { ThemeColors } from '@/constants/theme';
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
import { Button, IconButton } from '@/components/ui';

import type { Customer } from '@/db/models';
import {
    useCustomers,
    type CreateCustomerInput,
    type CustomerOrderHistory,
} from '@/hooks/use-customers';
import { formatIDR } from '@/utils/currency';

const PLACEHOLDER_COLOR = ThemeColors.text.faint;
const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

interface NewCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateCustomerInput) => Promise<void>;
  isLoading: boolean;
}

function NewCustomerModal({ visible, onClose, onCreate, isLoading }: NewCustomerModalProps) {
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-4">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full max-w-lg"
        >
          <View className="rounded-3xl bg-surface-card p-6">
            <Text className="mb-5 text-pos-xl font-bold text-pos-text">
              Register New Customer
            </Text>

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

            <View className="mb-6">
              <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                Notes{' '}<Text className="text-pos-text-muted">(optional)</Text>
              </Text>
              <TextInput
                value={form.notes}
                onChangeText={notes => setForm(p => ({ ...p, notes }))}
                placeholder="Dietary restrictions, preferences…"
                placeholderTextColor={PLACEHOLDER_COLOR}
                multiline
                numberOfLines={2}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
            </View>

            <View className="flex-row gap-3">
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
                  <Text className="text-pos-base font-bold text-white">Register Customer</Text>
                )}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface CustomerDetailProps {
  customer: Customer;
  onClose: () => void;
  getOrderHistory: (id: number) => Promise<CustomerOrderHistory[]>;
}

function CustomerDetail({ customer, onClose, getOrderHistory }: CustomerDetailProps) {
  const [orderHistory, setOrderHistory] = useState<CustomerOrderHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const customerId = toInt(customer.id);

  useEffect(() => {
    setHistoryLoading(true);
    getOrderHistory(customerId)
      .then(setOrderHistory)
      .catch(() => setOrderHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [customerId, getOrderHistory]);

  return (
    <View className="flex-1">
      <View className="border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-pos-2xl font-bold text-pos-text" numberOfLines={1}>
              {customer.name}
            </Text>
            {customer.phone ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <Phone size={12} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">{customer.phone}</Text>
              </View>
            ) : null}
            {customer.email ? (
              <View className="flex-row items-center gap-1.5">
                <Mail size={12} color={ThemeColors.text.muted} />
                <Text className="text-pos-sm text-pos-text-muted">{customer.email}</Text>
              </View>
            ) : null}
          </View>
          <IconButton size="lg" onPress={onClose} className="ml-4 rounded-full bg-surface-raised">
            <X size={18} color={ThemeColors.text.muted} />
          </IconButton>
        </View>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-brand/10 p-3">
            <Text className="text-pos-xs text-pos-text-muted">Loyalty Points</Text>
            <Text className="text-pos-2xl font-bold text-brand">
              {customer.loyalty_points.toLocaleString('id-ID')}
            </Text>
          </View>
          <View className="flex-1 rounded-xl bg-surface-raised p-3">
            <Text className="text-pos-xs text-pos-text-muted">Total Visits</Text>
            <Text className="text-pos-2xl font-bold text-pos-text">{customer.total_visits}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-surface-raised p-3">
            <Text className="text-pos-xs text-pos-text-muted">Total Spent</Text>
            <Text className="text-pos-lg font-bold text-pos-text">
              {formatIDR(customer.total_spent)}
            </Text>
          </View>
        </View>

        {customer.notes ? (
          <Text className="mt-3 text-pos-xs italic text-pos-text-muted">{customer.notes}</Text>
        ) : null}
      </View>

      <Text className="px-6 py-4 text-pos-base font-bold text-pos-text">Order History</Text>

      {historyLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : orderHistory.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-pos-sm text-pos-text-muted">No orders yet</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6">
          {orderHistory.map((order) => (
            <View
              key={order.id}
              className="mb-3 flex-row items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <View>
                <Text className="text-pos-sm font-semibold text-pos-text">
                  {order.order_number}
                </Text>
                <Text className="text-pos-xs capitalize text-pos-text-muted">
                  {order.order_type} · {order.status}
                </Text>
                <Text className="text-pos-xs text-pos-text-muted">
                  {new Date(order.created_at).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text className="text-pos-base font-bold text-pos-text">
                {formatIDR(order.total)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function CustomersScreen() {
  const {
    customers,
    isLoading,
    searchQuery,
    setSearchQuery,
    isCreating,
    createCustomer,
    getCustomerOrderHistory,
  } = useCustomers();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const selectedId = selectedCustomer ? toInt(selectedCustomer.id) : null;

  const handleCreate = useCallback(
    async (input: CreateCustomerInput) => {
      const created = await createCustomer(input);
      setShowNewModal(false);
      setSelectedCustomer(created);
    },
    [createCustomer],
  );

  return (
    <View className="flex-1 flex-row bg-surface">
      <View className="w-[38%] border-r border-border bg-surface-card">
        <View className="border-b border-border px-5 py-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-pos-2xl font-bold text-pos-text">Customers</Text>
            <Button
              onPress={() => setShowNewModal(true)}
              className="flex-row items-center rounded-xl bg-brand px-4 py-2.5"
            >
              <Text className="text-pos-sm font-bold text-white">+ Register</Text>
            </Button>
          </View>

          <View className="mt-4 flex-row items-center rounded-xl border border-border bg-surface px-4 py-2.5">
            <Search size={16} color={ThemeColors.text.muted} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search name or phone…"
              placeholderTextColor={PLACEHOLDER_COLOR}
              className="flex-1 text-pos-base text-pos-text"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={16} color={ThemeColors.text.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : customers.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <User size={32} color={ThemeColors.text.muted} />
            <Text className="mt-3 text-center text-pos-base text-pos-text-muted">
              {searchQuery
                ? `No customers matching "${searchQuery}"`
                : 'No customers yet. Register the first one!'}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1">
            {customers.map((customer) => {
              const isSelected = selectedId === toInt(customer.id);
              return (
                <Pressable
                  key={customer.id}
                  onPress={() => setSelectedCustomer(customer)}
                  className={`border-b border-border px-5 py-4 active:bg-surface-raised ${
                    isSelected ? 'bg-brand/10' : ''
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/20">
                      <Text className="text-pos-base font-bold text-brand">
                        {customer.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-pos-base font-semibold ${
                          isSelected ? 'text-brand' : 'text-pos-text'
                        }`}
                        numberOfLines={1}
                      >
                        {customer.name}
                      </Text>
                      <Text className="text-pos-xs text-pos-text-muted">
                        {customer.phone ?? 'No phone'}
                      </Text>
                    </View>
                    {customer.loyalty_points > 0 && (
                      <View className="rounded-full bg-brand/10 px-2 py-0.5">
                        <Text className="text-pos-xs font-semibold text-brand">
                          <Star size={10} color={ThemeColors.accent.primary} />{' '}
                          {customer.loyalty_points}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="mt-1.5 flex-row gap-4 pl-14">
                    <Text className="text-pos-xs text-pos-text-muted">
                      {customer.total_visits} visit{customer.total_visits !== 1 ? 's' : ''}
                    </Text>
                    <Text className="text-pos-xs text-pos-text-muted">
                      {formatIDR(customer.total_spent)} spent
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View className="flex-1">
        {selectedCustomer ? (
          <CustomerDetail
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            getOrderHistory={getCustomerOrderHistory}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-surface-card">
              <Users size={40} color={ThemeColors.text.muted} />
            </View>
            <Text className="text-pos-xl font-semibold text-pos-text">Customer Details</Text>
            <Text className="mt-2 text-center text-pos-base text-pos-text-muted">
              Select a customer from the list to view their profile,{'\n'}
              order history and loyalty points.
            </Text>
            <Button
              onPress={() => setShowNewModal(true)}
              className="mt-6 flex-row items-center rounded-2xl bg-brand px-6 py-3.5"
            >
              <Text className="text-pos-base font-bold text-white">+ Register New Customer</Text>
            </Button>
          </View>
        )}
      </View>

      <NewCustomerModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
        isLoading={isCreating}
      />
    </View>
  );
}
