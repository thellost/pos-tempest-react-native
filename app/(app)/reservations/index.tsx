import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronDown,
  Plus,
  WifiOff,
  X,
} from 'lucide-react-native';
import { Button, IconButton } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { RESERVATION_STATUS, type ReservationStatus } from '@/constants/enums';
import { useOnlineCheck } from '@/hooks/use-online-check';
import { useReservations, type ReservationWithCustomer } from '@/hooks/use-reservations';
import { useTables } from '@/hooks/use-tables';
import { useCustomers } from '@/hooks/use-customers';
import { toInt } from '@/utils/coerce';

// ─── Constants ────────────────────────────────────────────────────────────────

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

type FilterTab = 'active' | 'all';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${STATUS_COLORS[status].split(' ')[0]}`}>
      <Text className={`text-[11px] font-semibold ${STATUS_COLORS[status].split(' ')[1]}`}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReservationsScreen() {
  const { isOnline, isChecking, checkOnline } = useOnlineCheck();

  useEffect(() => {
    checkOnline();
  }, [checkOnline]);

  if (isChecking || isOnline === null) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Checking connection...</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <WifiOff size={32} color={ThemeColors.text.muted} />
        </View>
        <Text className="text-pos-xl font-semibold text-pos-text">No Connection</Text>
        <Text className="mt-2 text-center text-pos-base text-pos-text-muted">
          Reservations require an internet connection for backend verification.
        </Text>
        <Button
          onPress={checkOnline}
          className="mt-6 rounded-lg bg-brand px-6 py-3"
        >
          <Text className="text-pos-base font-semibold text-white">Retry</Text>
        </Button>
      </View>
    );
  }

  return <ReservationsContent />;
}

// ─── Content (only rendered when online) ─────────────────────────────────────

function ReservationsContent() {
  const {
    activeReservations,
    allReservations,
    isLoading,
    allLoading,
    createReservation,
    updateReservationStatus,
    formatReservationTime,
  } = useReservations();

  const { tables } = useTables();
  const { customers, searchQuery, setSearchQuery } = useCustomers();

  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form state
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('90');
  const [notes, setNotes] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);

  const activeTables = tables.filter((t) => t.is_active && t.status !== 'maintenance');

  const displayedReservations =
    filterTab === 'active' ? activeReservations : allReservations;

  const resetForm = useCallback(() => {
    setGuestName('');
    setGuestPhone('');
    setGuestCount('2');
    setReservationDate('');
    setReservationTime('');
    setDurationMinutes('90');
    setNotes('');
    setSelectedTableId(null);
    setSelectedCustomerId(null);
    setSearchQuery('');
    setShowCustomerSearch(false);
    setShowTablePicker(false);
  }, [setSearchQuery]);

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const handleCloseCreate = () => {
    setShowCreateForm(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!guestName.trim()) {
      Alert.alert('Validation', 'Customer name is required.');
      return;
    }
    if (!selectedTableId) {
      Alert.alert('Validation', 'Please select a table.');
      return;
    }
    if (!reservationDate.trim() || !reservationTime.trim()) {
      Alert.alert('Validation', 'Please enter date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }
    const count = parseInt(guestCount, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Validation', 'Guest count must be at least 1.');
      return;
    }

    const isoDatetime = `${reservationDate.trim()}T${reservationTime.trim()}:00.000Z`;

    setIsSubmitting(true);
    try {
      await createReservation({
        table_id: selectedTableId,
        customer_id: selectedCustomerId,
        customer_name: guestName.trim(),
        customer_phone: guestPhone.trim() || null,
        guest_count: count,
        reservation_datetime: isoDatetime,
        duration_minutes: parseInt(durationMinutes, 10) || 90,
        notes: notes.trim() || null,
      });
      handleCloseCreate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reservation.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusAction = (reservation: ReservationWithCustomer, status: ReservationStatus) => {
    Alert.alert(
      `Mark as ${STATUS_LABELS[status]}`,
      `Set ${reservation.resolved_customer_name} to ${STATUS_LABELS[status]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateReservationStatus(toInt(reservation.id), status);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to update reservation.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const selectedTableLabel = selectedTableId
    ? activeTables.find((t) => toInt(t.id) === selectedTableId)?.table_number ?? 'Unknown'
    : null;

  const isContentLoading = filterTab === 'active' ? isLoading : allLoading;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="border-b border-border bg-surface-card px-5 py-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <CalendarDays size={24} color={ThemeColors.accent.primary} />
            <Text className="text-pos-2xl font-bold text-pos-text">Reservations</Text>
          </View>
          <Button
            onPress={handleOpenCreate}
            className="flex-row items-center rounded-lg bg-brand px-5 py-3"
          >
            <Plus size={18} color="white" />
            <Text className="ml-2 text-pos-base font-bold text-white">New Reservation</Text>
          </Button>
        </View>

        {/* Filter tabs */}
        <View className="mt-4 flex-row gap-2">
          {(['active', 'all'] as FilterTab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setFilterTab(tab)}
              className={`rounded-lg px-4 py-2 ${
                filterTab === tab ? 'bg-brand' : 'bg-surface-raised'
              }`}
            >
              <Text
                className={`text-pos-sm font-semibold capitalize ${
                  filterTab === tab ? 'text-white' : 'text-pos-text-muted'
                }`}
              >
                {tab === 'active' ? 'Active' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      {isContentLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : displayedReservations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <CalendarDays size={40} color={ThemeColors.text.muted} />
          <Text className="mt-4 text-pos-base text-pos-text-muted">No reservations found</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {displayedReservations.map((res) => (
            <ReservationRow
              key={res.id}
              reservation={res}
              tableName={
                activeTables.find((t) => toInt(t.id) === toInt(res.table_id))?.table_number ?? `#${res.table_id}`
              }
              formattedTime={formatReservationTime(res.reservation_datetime)}
              onStatusAction={handleStatusAction}
            />
          ))}
        </ScrollView>
      )}

      {/* Create Form Panel */}
      {showCreateForm && (
        <View className="absolute inset-0 bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end"
          >
            <View className="max-h-[85%] rounded-t-2xl bg-surface-card">
              {/* Form header */}
              <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
                <Text className="text-pos-lg font-bold text-pos-text">New Reservation</Text>
                <IconButton icon={X} onPress={handleCloseCreate} size={22} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                {/* Customer name */}
                <View className="mb-4">
                  <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                    Customer Name <Text className="text-pos-danger">*</Text>
                  </Text>
                  <TextInput
                    value={guestName}
                    onChangeText={(v) => {
                      setGuestName(v);
                      setSearchQuery(v);
                      setShowCustomerSearch(v.length > 0);
                      setSelectedCustomerId(null);
                    }}
                    placeholder="Enter customer name"
                    placeholderTextColor={ThemeColors.text.faint}
                    className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                  />
                  {showCustomerSearch && customers.length > 0 && (
                    <View className="mt-1 rounded-lg border border-border bg-surface-card">
                      {customers.slice(0, 5).map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            setGuestName(c.name);
                            setGuestPhone(c.phone ?? '');
                            setSelectedCustomerId(toInt(c.id));
                            setShowCustomerSearch(false);
                          }}
                          className="border-b border-border px-4 py-2.5 last:border-0 active:bg-surface-raised"
                        >
                          <Text className="text-pos-sm text-pos-text">{c.name}</Text>
                          {c.phone ? (
                            <Text className="text-pos-xs text-pos-text-muted">{c.phone}</Text>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Phone */}
                <View className="mb-4">
                  <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Phone</Text>
                  <TextInput
                    value={guestPhone}
                    onChangeText={setGuestPhone}
                    placeholder="e.g. 08123456789"
                    placeholderTextColor={ThemeColors.text.faint}
                    keyboardType="phone-pad"
                    className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                  />
                </View>

                {/* Table + Guest count row */}
                <View className="mb-4 flex-row gap-3">
                  <View className="flex-1">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                      Table <Text className="text-pos-danger">*</Text>
                    </Text>
                    <Pressable
                      onPress={() => setShowTablePicker((v) => !v)}
                      className="flex-row items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                    >
                      <Text className={selectedTableLabel ? 'text-pos-base text-pos-text' : 'text-pos-base text-pos-text-faint'}>
                        {selectedTableLabel ?? 'Select table'}
                      </Text>
                      <ChevronDown size={16} color={ThemeColors.text.muted} />
                    </Pressable>
                    {showTablePicker && (
                      <View className="mt-1 max-h-40 rounded-lg border border-border bg-surface-card">
                        <ScrollView>
                          {activeTables.map((t) => (
                            <Pressable
                              key={t.id}
                              onPress={() => {
                                setSelectedTableId(toInt(t.id));
                                setShowTablePicker(false);
                              }}
                              className="border-b border-border px-4 py-2.5 last:border-0 active:bg-surface-raised"
                            >
                              <Text className="text-pos-sm text-pos-text">
                                Table {t.table_number}
                                <Text className="text-pos-text-muted"> · cap {t.capacity}</Text>
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View className="w-24">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Guests</Text>
                    <TextInput
                      value={guestCount}
                      onChangeText={setGuestCount}
                      keyboardType="number-pad"
                      className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                  </View>
                </View>

                {/* Date + Time row */}
                <View className="mb-4 flex-row gap-3">
                  <View className="flex-1">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                      Date <Text className="text-pos-danger">*</Text>
                    </Text>
                    <TextInput
                      value={reservationDate}
                      onChangeText={setReservationDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={ThemeColors.text.faint}
                      className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                  </View>
                  <View className="w-28">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                      Time <Text className="text-pos-danger">*</Text>
                    </Text>
                    <TextInput
                      value={reservationTime}
                      onChangeText={setReservationTime}
                      placeholder="HH:MM"
                      placeholderTextColor={ThemeColors.text.faint}
                      className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                  </View>
                </View>

                {/* Duration */}
                <View className="mb-4">
                  <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Duration (minutes)</Text>
                  <TextInput
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="number-pad"
                    className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                  />
                </View>

                {/* Notes */}
                <View className="mb-6">
                  <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any special requests..."
                    placeholderTextColor={ThemeColors.text.faint}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="rounded-lg border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    style={{ minHeight: 72 }}
                  />
                </View>

                {/* Submit */}
                <Button
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand py-4"
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-center text-pos-base font-bold text-white">
                      Create Reservation
                    </Text>
                  )}
                </Button>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

// ─── Reservation Row ──────────────────────────────────────────────────────────

interface ReservationRowProps {
  reservation: ReservationWithCustomer;
  tableName: string;
  formattedTime: string;
  onStatusAction: (reservation: ReservationWithCustomer, status: ReservationStatus) => void;
}

function ReservationRow({ reservation, tableName, formattedTime, onStatusAction }: ReservationRowProps) {
  const status = reservation.status as ReservationStatus;
  const isActive = status === RESERVATION_STATUS.CONFIRMED || status === RESERVATION_STATUS.SEATED;

  return (
    <View className="mb-3 rounded-xl border border-border bg-surface-card p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-pos-base font-semibold text-pos-text">
            {reservation.resolved_customer_name}
          </Text>
          <Text className="mt-0.5 text-pos-sm text-pos-text-muted">
            Table {tableName} · {reservation.guest_count} guest{reservation.guest_count !== 1 ? 's' : ''}
          </Text>
          <Text className="mt-0.5 text-pos-sm text-pos-text-muted">{formattedTime}</Text>
          {reservation.customer_phone ? (
            <Text className="mt-0.5 text-pos-xs text-pos-text-muted">{reservation.customer_phone}</Text>
          ) : null}
          {reservation.notes ? (
            <Text className="mt-1 text-pos-xs italic text-pos-text-muted" numberOfLines={2}>
              {reservation.notes}
            </Text>
          ) : null}
        </View>
        <StatusBadge status={status} />
      </View>

      {isActive && (
        <View className="mt-3 flex-row gap-2 border-t border-border pt-3">
          {status === RESERVATION_STATUS.CONFIRMED && (
            <Pressable
              onPress={() => onStatusAction(reservation, RESERVATION_STATUS.SEATED)}
              className="flex-1 rounded-lg bg-status-available/20 py-2"
            >
              <Text className="text-center text-pos-sm font-semibold text-status-available">
                Seat
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onStatusAction(reservation, RESERVATION_STATUS.NO_SHOW)}
            className="flex-1 rounded-lg bg-surface-raised py-2"
          >
            <Text className="text-center text-pos-sm font-semibold text-pos-text-muted">
              No Show
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onStatusAction(reservation, RESERVATION_STATUS.CANCELLED)}
            className="flex-1 rounded-lg bg-pos-danger/10 py-2"
          >
            <Text className="text-center text-pos-sm font-semibold text-pos-danger">
              Cancel
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
