import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ArrowLeft, CheckCircle, Star, X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { Button, IconButton } from '@/components/ui';

interface ReservationFormProps {
  guestName: string;
  setGuestName: (v: string) => void;
  guestPhone: string;
  setGuestPhone: (v: string) => void;
  guestCount: string;
  setGuestCount: (v: string) => void;
  reservationDate: string;
  setReservationDate: (v: string) => void;
  reservationTime: string;
  setReservationTime: (v: string) => void;
  durationMinutes: string;
  setDurationMinutes: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  selectedCustomerId: number | null;
  setSelectedCustomerId: (id: number | null) => void;
  customers: Array<{ id: number; name: string; phone: string | null; loyalty_points: number }>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

export function ReservationForm({
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  guestCount,
  setGuestCount,
  reservationDate,
  setReservationDate,
  reservationTime,
  setReservationTime,
  durationMinutes,
  setDurationMinutes,
  notes,
  setNotes,
  selectedCustomerId,
  setSelectedCustomerId,
  customers,
  setSearchQuery,
  isSubmitting,
  onSubmit,
  onBack,
}: ReservationFormProps) {
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const handleSelectCustomer = useCallback(
    (customer: { id: number; name: string; phone: string | null }) => {
      setSelectedCustomerId(customer.id);
      setGuestName(customer.name);
      setGuestPhone(customer.phone ?? '');
      setShowCustomerSearch(false);
      setSearchQuery('');
    },
    [setSelectedCustomerId, setGuestName, setGuestPhone, setSearchQuery]
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
      <View className="mb-5 flex-row items-center gap-3">
        <IconButton
          size="md"
          onPress={onBack}
          className="rounded-full bg-surface-raised"
        >
          <ArrowLeft size={18} color={ThemeColors.text.primary} />
        </IconButton>
        <Text className="text-pos-lg font-bold text-pos-text">New Reservation</Text>
      </View>

      {/* Customer name with search */}
      <View className="mb-4">
        <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
          Customer Name *
        </Text>
        <TextInput
          value={guestName}
          onChangeText={(v) => {
            setGuestName(v);
            if (v.length >= 2) {
              setSearchQuery(v);
              setShowCustomerSearch(true);
            } else {
              setShowCustomerSearch(false);
            }
          }}
          placeholder="Enter customer name"
          placeholderTextColor="#6B7280"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
        />
        {/* Customer search results */}
        {showCustomerSearch && customers.length > 0 && (
          <View className="mt-1 rounded-xl border border-border bg-surface-card shadow-lg">
            {customers.slice(0, 5).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => handleSelectCustomer(c as { id: number; name: string; phone: string | null })}
                className="border-b border-border px-4 py-3 last:border-b-0 active:bg-surface-raised"
              >
                <Text className="text-pos-sm font-semibold text-pos-text">{c.name}</Text>
                {c.phone ? (
                  <Text className="text-pos-xs text-pos-text-muted">{c.phone}</Text>
                ) : null}
                {c.loyalty_points > 0 ? (
                  <View className="flex-row items-center gap-0.5">
                    <Star size={10} color={ThemeColors.accent.primary} />
                    <Text className="text-pos-xs text-brand">{c.loyalty_points} pts</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowCustomerSearch(false)}
              className="px-4 py-2 active:bg-surface-raised"
            >
              <Text className="text-center text-pos-xs text-pos-text-muted">Dismiss</Text>
            </Pressable>
          </View>
        )}
        {selectedCustomerId && (
          <View className="mt-1.5 flex-row items-center gap-2 rounded-lg bg-brand/10 px-3 py-1.5">
            <View className="flex-row items-center gap-1.5">
              <CheckCircle size={12} color={ThemeColors.accent.primary} />
              <Text className="text-pos-xs text-brand">Linked to existing customer</Text>
            </View>
            <Pressable onPress={() => setSelectedCustomerId(null)}>
              <Text className="text-pos-xs text-pos-danger">(unlink)</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Phone number */}
      <View className="mb-4">
        <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Phone Number</Text>
        <TextInput
          value={guestPhone}
          onChangeText={setGuestPhone}
          placeholder="e.g. 081234567890"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
        />
      </View>

      {/* Date and time side by side */}
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Date *</Text>
          <TextInput
            value={reservationDate}
            onChangeText={setReservationDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6B7280"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Time *</Text>
          <TextInput
            value={reservationTime}
            onChangeText={setReservationTime}
            placeholder="HH:MM"
            placeholderTextColor="#6B7280"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
          />
        </View>
      </View>

      {/* Guest count and duration */}
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Guests *</Text>
          <TextInput
            value={guestCount}
            onChangeText={setGuestCount}
            keyboardType="numeric"
            placeholder="2"
            placeholderTextColor="#6B7280"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Duration (min)</Text>
          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="numeric"
            placeholder="90"
            placeholderTextColor="#6B7280"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
          />
        </View>
      </View>

      {/* Notes */}
      <View className="mb-6">
        <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Special requests, seating preferences…"
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={3}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </View>

      {/* Submit */}
      <Button
        onPress={onSubmit}
        disabled={isSubmitting}
        className="items-center justify-center rounded-2xl bg-brand py-4"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-pos-base font-bold text-white">Save Reservation</Text>
        )}
      </Button>
    </ScrollView>
  );
}
