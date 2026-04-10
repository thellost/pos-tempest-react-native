import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Search, Star, User, Users, X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { Button } from '@/components/ui';
import { CustomerDetail } from '@/components/customers/CustomerDetail';
import { NewCustomerModal } from '@/components/customers/NewCustomerModal';
import type { Customer } from '@/db/models';
import { useCustomers, type CreateCustomerInput } from '@/hooks/use-customers';
import { formatIDR } from '@/utils/currency';
import { toInt } from '@/utils/coerce';

const PLACEHOLDER_COLOR = ThemeColors.text.faint;

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
