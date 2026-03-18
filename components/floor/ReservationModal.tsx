import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle, Star, X, XCircle } from 'lucide-react-native';
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

import type { ReservationStatus } from '@/constants/enums';
import { RESERVATION_STATUS } from '@/constants/enums';
import { useCustomers } from '@/hooks/use-customers';
import { useReservations, type ReservationWithCustomer } from '@/hooks/use-reservations';
import type { TableWithOrder } from '@/hooks/use-tables';
import { toInt } from '@/utils/coerce';

interface ReservationModalProps {
  visible: boolean;
  table: TableWithOrder | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  confirmed: 'bg-brand/20 text-brand',
  seated: 'bg-status-available/20 text-status-available',
  completed: 'bg-surface-raised text-pos-text-muted',
  no_show: 'bg-pos-danger/20 text-pos-danger',
  cancelled: 'bg-pos-danger/20 text-pos-danger',
};

/**
 * Modal shown when long-pressing a table on the floor plan.
 * Lists existing reservations for that table and allows creating new ones.
 */
export function ReservationModal({ visible, table, onClose }: ReservationModalProps) {
  const {
    getReservationsForTable,
    createReservation,
    updateReservationStatus,
    formatReservationTime,
  } = useReservations();

  const { customers, searchQuery, setSearchQuery } = useCustomers();

  const [view, setView] = useState<'list' | 'create'>('list');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form state
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('90');
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const tableId = table ? toInt(table.id) : null;

  const tableReservations = tableId ? getReservationsForTable(tableId) : [];

  // Reset form when modal opens/table changes
  useEffect(() => {
    if (visible) {
      setView('list');
      resetForm();
    }
  }, [visible, table]);

  const resetForm = () => {
    setGuestName('');
    setGuestPhone('');
    setGuestCount('2');
    setNotes('');
    setSelectedCustomerId(null);
    setSearchQuery('');
    setShowCustomerSearch(false);
    // Default to tomorrow at 19:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    setReservationDate(
      `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
    );
    setReservationTime('19:00');
    setDurationMinutes('90');
  };

  const handleSelectCustomer = useCallback(
    (customer: { id: number; name: string; phone: string | null }) => {
      setSelectedCustomerId(customer.id);
      setGuestName(customer.name);
      setGuestPhone(customer.phone ?? '');
      setShowCustomerSearch(false);
      setSearchQuery('');
    },
    [setSearchQuery]
  );

  const handleSubmit = async () => {
    if (!tableId) return;
    if (!guestName.trim()) {
      Alert.alert('Validation', 'Customer name is required.');
      return;
    }

    // Build ISO datetime from date + time inputs
    const datetimeStr = `${reservationDate}T${reservationTime}:00`;
    const parsed = new Date(datetimeStr);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Validation', 'Invalid date or time. Use YYYY-MM-DD and HH:MM formats.');
      return;
    }

    const count = parseInt(guestCount, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Validation', 'Guest count must be at least 1.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createReservation({
        table_id: tableId,
        customer_id: selectedCustomerId,
        customer_name: guestName.trim(),
        customer_phone: guestPhone.trim() || null,
        guest_count: count,
        reservation_datetime: parsed.toISOString(),
        duration_minutes: parseInt(durationMinutes, 10) || 90,
        notes: notes.trim() || null,
      });
      setView('list');
      resetForm();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    reservation: ReservationWithCustomer,
    newStatus: ReservationStatus
  ) => {
    const label = STATUS_LABELS[newStatus];
    Alert.alert(
      'Update Reservation',
      `Mark reservation for ${reservation.resolved_customer_name} as ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            try {
              const resId = toInt(reservation.id);
              await updateReservationStatus(resId, newStatus);
            } catch (err) {
              Alert.alert('Error', 'Failed to update reservation status.');
            }
          },
        },
      ]
    );
  };

  if (!table) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60"
        onPress={onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="absolute bottom-0 left-0 right-0"
      >
        <View className="rounded-t-3xl bg-surface-card" style={{ maxHeight: '80%' }}>
          {/* Handle bar */}
          <View className="items-center py-3">
            <View className="h-1.5 w-12 rounded-full bg-border" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-6 pb-4">
            <View>
              <Text className="text-pos-xl font-bold text-pos-text">
                Table {table.table_number}
              </Text>
              <Text className="text-pos-sm text-pos-text-muted">
                Capacity: {table.capacity} · {table.floor_area_name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface-raised active:bg-surface"
            >
              <X size={18} color={ThemeColors.text.muted} />
            </Pressable>
          </View>

          {view === 'list' ? (
            /* ── Reservation list view ── */
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-pos-lg font-semibold text-pos-text">
                  {tableReservations.length === 0
                    ? 'No active reservations'
                    : `${tableReservations.length} reservation${tableReservations.length > 1 ? 's' : ''}`}
                </Text>
                <Pressable
                  onPress={() => setView('create')}
                  className="flex-row items-center rounded-xl bg-brand px-4 py-2.5 active:bg-brand-hover"
                >
                  <Text className="text-pos-sm font-bold text-white">+ New Reservation</Text>
                </Pressable>
              </View>

              {tableReservations.length === 0 ? (
                <View className="items-center py-10">
                  <CalendarDays size={36} color={ThemeColors.text.muted} />
                  <Text className="mt-3 text-pos-base text-pos-text-muted">
                    No reservations for this table
                  </Text>
                  <Pressable
                    onPress={() => setView('create')}
                    className="mt-4 rounded-xl bg-brand px-6 py-3 active:bg-brand-hover"
                  >
                    <Text className="text-pos-base font-bold text-white">
                      Create Reservation
                    </Text>
                  </Pressable>
                </View>
              ) : (
                tableReservations.map((res) => (
                  <View
                    key={res.id}
                    className="mb-4 rounded-2xl border border-border bg-surface p-4"
                  >
                    {/* Status badge */}
                    <View className="mb-3 flex-row items-center justify-between">
                      <View
                        className={`rounded-full px-3 py-1 ${
                          res.status === RESERVATION_STATUS.CONFIRMED
                            ? 'bg-brand/20'
                            : 'bg-status-available/20'
                        }`}
                      >
                        <Text
                          className={`text-pos-xs font-bold ${
                            res.status === RESERVATION_STATUS.CONFIRMED
                              ? 'text-brand'
                              : 'text-status-available'
                          }`}
                        >
                          {STATUS_LABELS[res.status as ReservationStatus] ?? res.status}
                        </Text>
                      </View>
                      <Text className="text-pos-xs text-pos-text-muted">
                        {formatReservationTime(res.reservation_datetime)}
                      </Text>
                    </View>

                    {/* Customer info */}
                    <Text className="text-pos-base font-semibold text-pos-text">
                      {res.resolved_customer_name}
                    </Text>
                    {res.customer_phone ? (
                      <Text className="text-pos-sm text-pos-text-muted">{res.customer_phone}</Text>
                    ) : null}
                    <Text className="mt-1 text-pos-sm text-pos-text-muted">
                      {res.guest_count} guest{res.guest_count > 1 ? 's' : ''} · {res.duration_minutes}min
                    </Text>
                    {res.notes ? (
                      <Text className="mt-1 text-pos-xs italic text-pos-text-muted">{res.notes}</Text>
                    ) : null}

                    {/* Action buttons */}
                    {res.status === RESERVATION_STATUS.CONFIRMED && (
                      <View className="mt-3 flex-row gap-2">
                        <Pressable
                          onPress={() => handleStatusChange(res, RESERVATION_STATUS.SEATED)}
                          className="flex-1 items-center rounded-xl bg-status-available/20 py-2.5 active:bg-status-available/30"
                        >
                          <View className="flex-row items-center gap-1.5">
                            <CheckCircle size={14} color={ThemeColors.success.DEFAULT} />
                            <Text className="text-pos-sm font-semibold text-status-available">Seated</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => handleStatusChange(res, RESERVATION_STATUS.NO_SHOW)}
                          className="flex-1 items-center rounded-xl bg-pos-warning/20 py-2.5 active:bg-pos-warning/30"
                        >
                          <View className="flex-row items-center gap-1.5">
                            <XCircle size={14} color={ThemeColors.warning.DEFAULT} />
                            <Text className="text-pos-sm font-semibold text-pos-warning">No Show</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => handleStatusChange(res, RESERVATION_STATUS.CANCELLED)}
                          className="flex-1 items-center rounded-xl bg-pos-danger/20 py-2.5 active:bg-pos-danger/30"
                        >
                          <View className="flex-row items-center gap-1.5">
                            <X size={14} color={ThemeColors.danger.DEFAULT} />
                            <Text className="text-pos-sm font-semibold text-pos-danger">Cancel</Text>
                          </View>
                        </Pressable>
                      </View>
                    )}
                    {res.status === RESERVATION_STATUS.SEATED && (
                      <View className="mt-3 flex-row gap-2">
                        <Pressable
                          onPress={() => handleStatusChange(res, RESERVATION_STATUS.COMPLETED)}
                          className="flex-1 items-center rounded-xl bg-surface-raised py-2.5 active:bg-surface"
                        >
                          <Text className="text-pos-sm font-semibold text-pos-text-muted">
                            Mark Completed
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          ) : (
            /* ── Create reservation form ── */
            <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
              <View className="mb-5 flex-row items-center gap-3">
                <Pressable
                  onPress={() => setView('list')}
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface-raised"
                >
                  <ArrowLeft size={18} color={ThemeColors.text.primary} />
                </Pressable>
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
                      <Text className="text-center text-pos-xs text-pos-text-muted">
                        Dismiss
                      </Text>
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
                  <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                    Date *
                  </Text>
                  <TextInput
                    value={reservationDate}
                    onChangeText={setReservationDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6B7280"
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                    Time *
                  </Text>
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
                  <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                    Guests *
                  </Text>
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
                  <Text className="mb-1.5 text-pos-sm font-semibold text-pos-text">
                    Duration (min)
                  </Text>
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
              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                className="items-center rounded-2xl bg-brand py-4 active:bg-brand-hover disabled:opacity-50"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-pos-base font-bold text-white">Save Reservation</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
