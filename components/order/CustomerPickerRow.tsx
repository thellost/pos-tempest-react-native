import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useCustomers } from '@/hooks/use-customers';

export interface AssignedCustomer {
  id: number;
  name: string;
  phone: string | null;
  loyalty_points?: number;
}

interface CustomerPickerRowProps {
  assignedCustomer: AssignedCustomer | null;
  onAssign: (customer: AssignedCustomer) => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * Compact row in the order panel header that lets cashiers optionally
 * link a customer to the current order.
 *
 * Tapping opens a mini search modal (by name or phone).
 * An assigned customer is shown inline with a clear (×) button.
 */
export function CustomerPickerRow({
  assignedCustomer,
  onAssign,
  onClear,
  disabled = false,
}: CustomerPickerRowProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { customers, isLoading, searchQuery, setSearchQuery } = useCustomers();

  const inputRef = useRef<TextInput>(null);

  const open = useCallback(() => {
    if (disabled) return;
    setSearchQuery('');
    setModalVisible(true);
  }, [disabled, setSearchQuery]);

  const close = useCallback(() => {
    setModalVisible(false);
    setSearchQuery('');
  }, [setSearchQuery]);

  const handleSelect = useCallback(
    (customer: AssignedCustomer) => {
      onAssign(customer);
      close();
    },
    [onAssign, close]
  );

  return (
    <>
      {/* ── Inline row ── */}
      <View className="mt-2 flex-row items-center">
        {assignedCustomer ? (
          /* Customer is assigned — show chip + clear button */
          <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-brand/10 px-3 py-2">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-brand/30">
              <Text className="text-[10px] font-bold text-brand">
                {assignedCustomer.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-pos-xs font-semibold text-brand" numberOfLines={1}>
                {assignedCustomer.name}
              </Text>
              {assignedCustomer.phone ? (
                <Text className="text-[10px] text-pos-text-muted">{assignedCustomer.phone}</Text>
              ) : null}
            </View>
            {assignedCustomer.loyalty_points ? (
              <Text className="text-[10px] text-brand">⭐{assignedCustomer.loyalty_points}</Text>
            ) : null}
            <Pressable
              onPress={onClear}
              disabled={disabled}
              className="ml-1 h-5 w-5 items-center justify-center rounded-full bg-brand/20 active:bg-brand/40"
            >
              <Text className="text-[10px] font-bold text-brand">✕</Text>
            </Pressable>
          </View>
        ) : (
          /* No customer — show add button */
          <Pressable
            onPress={open}
            disabled={disabled}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 active:bg-surface-raised disabled:opacity-40"
          >
            <Text className="text-pos-xs text-pos-text-muted">👤 Add Customer</Text>
          </Pressable>
        )}
      </View>

      {/* ── Search modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable className="flex-1 bg-black/60" onPress={close} />

        <View className="absolute left-0 right-0 top-[20%] mx-auto max-w-md px-4">
          <View className="rounded-2xl bg-surface-card shadow-2xl">
            {/* Modal header */}
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3.5">
              <Text className="text-pos-base font-bold text-pos-text">Assign Customer</Text>
              <Pressable
                onPress={close}
                className="h-7 w-7 items-center justify-center rounded-full bg-surface-raised"
              >
                <Text className="text-pos-xs text-pos-text-muted">✕</Text>
              </Pressable>
            </View>

            {/* Search input */}
            <View className="border-b border-border px-4 py-3">
              <View className="flex-row items-center rounded-xl border border-border bg-surface px-3 py-2.5">
                <Text className="mr-2 text-pos-sm text-pos-text-muted">🔍</Text>
                <TextInput
                  ref={inputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name or phone…"
                  placeholderTextColor="#6B7280"
                  autoFocus
                  className="flex-1 text-pos-sm text-pos-text"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Text className="text-pos-sm text-pos-text-muted">✕</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Results */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 260 }}
            >
              {isLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#6366F1" />
                </View>
              ) : customers.length === 0 ? (
                <View className="items-center py-8">
                  <Text className="text-pos-sm text-pos-text-muted">
                    {searchQuery.length >= 1
                      ? `No customers matching "${searchQuery}"`
                      : 'Type to search customers'}
                  </Text>
                </View>
              ) : (
                customers.map((c) => {
                  const cId = typeof c.id === 'string' ? parseInt(c.id as string, 10) : (c.id as number);
                  return (
                    <Pressable
                      key={cId}
                      onPress={() =>
                        handleSelect({
                          id: cId,
                          name: c.name,
                          phone: c.phone ?? null,
                          loyalty_points: c.loyalty_points,
                        })
                      }
                      className="flex-row items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 active:bg-surface-raised"
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/20">
                        <Text className="text-pos-sm font-bold text-brand">
                          {c.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-pos-sm font-semibold text-pos-text">{c.name}</Text>
                        <Text className="text-pos-xs text-pos-text-muted">
                          {c.phone ?? 'No phone'}
                        </Text>
                      </View>
                      {c.loyalty_points > 0 && (
                        <Text className="text-pos-xs text-brand">⭐ {c.loyalty_points} pts</Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View className="border-t border-border px-4 py-3">
              <Text className="text-center text-[10px] text-pos-text-muted">
                Customer assignment is optional
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
