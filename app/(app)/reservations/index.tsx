import { useCallback, useEffect, useMemo, useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CalendarDays,
  Check,
  Clock,
  Pencil,
  Plus,
  Users,
  WifiOff,
  X,
} from 'lucide-react-native';
import { Button, IconButton } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { RESERVATION_STATUS, TABLE_STATUS, type ReservationStatus } from '@/constants/enums';
import { useOnlineCheck } from '@/hooks/use-online-check';
import { useReservations, type ReservationWithCustomer } from '@/hooks/use-reservations';
import { useTables, type TableWithOrder } from '@/hooks/use-tables';
import { useCustomers } from '@/hooks/use-customers';
import { toInt, toIntOrNull } from '@/utils/coerce';
import {
  getAppDateString,
  isoToPickerDate,
  nowAppLocalDate,
  pickerDateToISO,
} from '@/utils/date';
import { getAppTimezone } from '@/utils/timezone';

// ─── Types ────────────────────────────────────────────────────────────────────

type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';
type StatusFilter = ReservationStatus | 'all';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<ReservationStatus, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-brand/20', text: 'text-brand' },
  seated: { bg: 'bg-status-available/20', text: 'text-status-available' },
  completed: { bg: 'bg-surface-raised', text: 'text-pos-text-muted' },
  no_show: { bg: 'bg-pos-danger/20', text: 'text-pos-danger' },
  cancelled: { bg: 'bg-pos-danger/20', text: 'text-pos-danger' },
};

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This Week',
  all: 'All',
};

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'seated', label: 'Seated' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD of a reservation ISO string, in Jakarta timezone. */
function reservationDateInJakarta(isoDatetime: string): string {
  return getAppDateString(new Date(isoDatetime));
}

function computeEndTime(isoDatetime: string, durationMinutes: number): string {
  const start = new Date(isoDatetime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: getAppTimezone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(end);
}

function filterByDate(reservations: ReservationWithCustomer[], filter: DateFilter): ReservationWithCustomer[] {
  if (filter === 'all') return reservations;
  const now = new Date();
  const today = getAppDateString(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = getAppDateString(tomorrowDate);
  const weekDate = new Date(now);
  weekDate.setDate(now.getDate() + 7);
  const weekEnd = getAppDateString(weekDate);

  return reservations.filter((r) => {
    const d = r.reservation_datetime.slice(0, 10);
    if (filter === 'today') return d === today;
    if (filter === 'tomorrow') return d === tomorrow;
    if (filter === 'week') return d >= today && d <= weekEnd;
    return true;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReservationStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View className={`rounded px-2.5 py-0.5 ${c.bg}`}>
      <Text className={`text-[11px] font-semibold ${c.text}`}>{STATUS_LABELS[status]}</Text>
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
        <Button onPress={checkOnline} className="mt-6 rounded-sm bg-brand px-6 py-3">
          <Text className="text-pos-base font-semibold text-white">Retry</Text>
        </Button>
      </View>
    );
  }

  return <ReservationsContent />;
}

// ─── Content ──────────────────────────────────────────────────────────────────

function ReservationsContent() {
  const {
    allReservations,
    allLoading,
    createReservation,
    updateReservation,
    updateReservationStatus,
    formatReservationTime,
  } = useReservations();

  const { tables, floorAreas, getTablesForArea } = useTables();
  const { customers, searchQuery, setSearchQuery } = useCustomers();

  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<ReservationWithCustomer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [reservationDateTime, setReservationDateTime] = useState<Date>(() => {
    const d = nowAppLocalDate();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('120');
  const [notes, setNotes] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const today = getAppDateString();
  const weekEnd = getAppDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const todayCount = allReservations.filter((r) => reservationDateInJakarta(r.reservation_datetime) === today).length;
  const confirmedCount = allReservations.filter((r) => reservationDateInJakarta(r.reservation_datetime) === today && r.status === RESERVATION_STATUS.CONFIRMED).length;
  const seatedCount = allReservations.filter((r) => r.status === RESERVATION_STATUS.SEATED).length;
  const weekCount = allReservations.filter((r) => {
    const d = reservationDateInJakarta(r.reservation_datetime);
    return d >= today && d <= weekEnd;
  }).length;

  // ── Filtered list ──────────────────────────────────────────────────────────

  const displayedReservations = useMemo(() => {
    let list = filterByDate(allReservations, dateFilter);
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [allReservations, dateFilter, statusFilter]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setGuestName('');
    setGuestPhone('');
    setGuestCount('2');
    setReservationDateTime(() => {
      const d = nowAppLocalDate();
      d.setDate(d.getDate() + 1);
      d.setHours(19, 0, 0, 0);
      return d;
    });
    setShowDatePicker(false);
    setShowTimePicker(false);
    setDurationMinutes('120');
    setNotes('');
    setSelectedTableId(null);
    setSelectedCustomerId(null);
    setSearchQuery('');
    setShowCustomerSearch(false);
    setShowTableModal(false);
    setEditingReservation(null);
  }, [setSearchQuery]);

  const handleOpenCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (reservation: ReservationWithCustomer) => {
    setEditingReservation(reservation);
    setGuestName(reservation.resolved_customer_name);
    setGuestPhone(reservation.customer_phone ?? '');
    setGuestCount(String(reservation.guest_count));
    setNotes(reservation.notes ?? '');
    setSelectedTableId(toIntOrNull(reservation.table_id));
    setSelectedCustomerId(toIntOrNull(reservation.customer_id));
    setReservationDateTime(isoToPickerDate(reservation.reservation_datetime));
    setDurationMinutes(String(reservation.duration_minutes));
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (editingReservation) {
      // Edit mode — only update guest_count, table_id, notes
      const count = parseInt(guestCount, 10);
      if (isNaN(count) || count < 1) {
        Alert.alert('Validation', 'Guest count must be at least 1.');
        return;
      }
      setIsSubmitting(true);
      try {
        await updateReservation(toInt(editingReservation.id), {
          guest_count: count,
          table_id: selectedTableId,
          notes: notes.trim() || null,
        });
        handleCloseForm();
      } catch (err: unknown) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update reservation.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Create mode
    if (!guestName.trim()) {
      Alert.alert('Validation', 'Customer name is required.');
      return;
    }
    if (!selectedTableId) {
      Alert.alert('Validation', 'Please select a table.');
      return;
    }
    const count = parseInt(guestCount, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Validation', 'Guest count must be at least 1.');
      return;
    }

    const isoDatetime = pickerDateToISO(reservationDateTime);
    setIsSubmitting(true);
    try {
      await createReservation({
        table_id: selectedTableId,
        customer_id: selectedCustomerId,
        customer_name: guestName.trim(),
        customer_phone: guestPhone.trim() || null,
        guest_count: count,
        reservation_datetime: isoDatetime,
        duration_minutes: parseInt(durationMinutes, 10) || 120,
        notes: notes.trim() || null,
      });
      handleCloseForm();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create reservation.');
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
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status.');
            }
          },
        },
      ]
    );
  };

  const selectedTable = selectedTableId
    ? tables.find((t) => toInt(t.id) === selectedTableId) ?? null
    : null;
  const selectedTableLabel = selectedTable
    ? `${selectedTable.floor_area_name ? `${selectedTable.floor_area_name} · ` : ''}Table ${selectedTable.table_number}`
    : null;

  const isEditMode = editingReservation !== null;

  // Preview end time in form
  const endTimePreview = useMemo(() => {
    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur)) return null;
    const totalMin = reservationDateTime.getHours() * 60 + reservationDateTime.getMinutes() + dur;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [reservationDateTime, durationMinutes]);

  return (
    <View className="flex-1 bg-surface">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View className="border-b border-border bg-surface-card px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <CalendarDays size={24} color={ThemeColors.accent.primary} />
            <Text className="text-pos-2xl font-bold text-pos-text">Reservations</Text>
          </View>
          <Button
            onPress={handleOpenCreate}
            className="flex-row items-center rounded-sm bg-brand px-4 py-2.5"
          >
            <Plus size={17} color="white" />
            <Text className="ml-1.5 text-pos-sm font-bold text-white">New</Text>
          </Button>
        </View>

        {/* Stats strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 -mx-1">
          <View className="flex-row gap-2 px-1">
            <StatChip label="Today" value={todayCount} color="text-brand" bg="bg-brand/10" />
            <StatChip label="Confirmed" value={confirmedCount} color="text-brand" bg="bg-brand/10" />
            <StatChip label="Seated" value={seatedCount} color="text-status-available" bg="bg-status-available/10" />
            <StatChip label="This Week" value={weekCount} color="text-pos-text" bg="bg-surface-raised" />
          </View>
        </ScrollView>

        {/* Date filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
          <View className="flex-row gap-2 px-1">
            {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => setDateFilter(f)}
                className={`rounded-sm px-4 py-1.5 ${dateFilter === f ? 'bg-brand' : 'bg-surface-raised'}`}
              >
                <Text className={`text-pos-sm font-semibold ${dateFilter === f ? 'text-white' : 'text-pos-text-muted'}`}>
                  {DATE_FILTER_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 -mx-1">
          <View className="flex-row gap-2 px-1">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setStatusFilter(opt.value)}
                className={`rounded-sm px-3 py-1 ${statusFilter === opt.value ? 'bg-surface-card border border-brand' : 'bg-surface-raised'}`}
              >
                <Text className={`text-pos-xs font-semibold ${statusFilter === opt.value ? 'text-brand' : 'text-pos-text-muted'}`}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {allLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        </View>
      ) : displayedReservations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
            <CalendarDays size={32} color={ThemeColors.text.muted} />
          </View>
          <Text className="text-pos-base font-semibold text-pos-text">No reservations</Text>
          <Text className="mt-1 text-pos-sm text-pos-text-muted">
            {dateFilter !== 'all' ? `No reservations for ${DATE_FILTER_LABELS[dateFilter].toLowerCase()}` : 'No reservations found'}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {displayedReservations.map((res) => (
            <ReservationRow
              key={res.id}
              reservation={res}
              tableName={
                tables.find((t) => toInt(t.id) === toIntOrNull(res.table_id))?.table_number ?? `#${res.table_id}`
              }
              formattedTime={formatReservationTime(res.reservation_datetime)}
              endTime={computeEndTime(res.reservation_datetime, res.duration_minutes)}
              onStatusAction={handleStatusAction}
              onEdit={() => handleOpenEdit(res)}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Table Picker Modal ────────────────────────────────────────────── */}
      <TablePickerModal
        visible={showTableModal}
        floorAreas={floorAreas}
        getTablesForArea={getTablesForArea}
        selectedTableId={selectedTableId}
        onSelect={(id) => {
          setSelectedTableId(id);
          setShowTableModal(false);
        }}
        onClose={() => setShowTableModal(false)}
      />

      {/* ── Create / Edit Form ─────────────────────────────────────────────── */}
      {showForm && (
        <View className="absolute inset-0 bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end"
          >
            <View className="max-h-[88%] rounded-t-xl bg-surface-card">
              {/* Form header */}
              <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
                <Text className="text-pos-lg font-bold text-pos-text">
                  {isEditMode ? 'Edit Reservation' : 'New Reservation'}
                </Text>
                <IconButton onPress={handleCloseForm}>
                  <X size={22} color={ThemeColors.text.muted} />
                </IconButton>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

                {/* Customer name — read-only in edit mode */}
                {isEditMode ? (
                  <View className="mb-4">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Customer</Text>
                    <View className="rounded-sm border border-border bg-surface/50 px-4 py-3">
                      <Text className="text-pos-base text-pos-text">{guestName}</Text>
                    </View>
                  </View>
                ) : (
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
                      className="rounded-sm border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                    {showCustomerSearch && customers.length > 0 && (
                      <View className="mt-1 rounded-sm border border-border bg-surface-card">
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
                )}

                {/* Phone — create mode only */}
                {!isEditMode && (
                  <View className="mb-4">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Phone</Text>
                    <TextInput
                      value={guestPhone}
                      onChangeText={setGuestPhone}
                      placeholder="e.g. 08123456789"
                      placeholderTextColor={ThemeColors.text.faint}
                      keyboardType="phone-pad"
                      className="rounded-sm border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                  </View>
                )}

                {/* Table + Guest count */}
                <View className="mb-4 flex-row gap-3">
                  <View className="flex-1">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                      Table {!isEditMode && <Text className="text-pos-danger">*</Text>}
                    </Text>
                    <Pressable
                      onPress={() => setShowTableModal(true)}
                      className={`flex-row items-center justify-between rounded-sm border px-4 py-3 ${
                        selectedTableLabel ? 'border-brand bg-brand/5' : 'border-border bg-surface'
                      }`}
                    >
                      <Text className={selectedTableLabel ? 'text-pos-sm font-semibold text-brand' : 'text-pos-base text-pos-text-faint'}>
                        {selectedTableLabel ?? 'Tap to select table…'}
                      </Text>
                      {selectedTableLabel
                        ? <Check size={16} color={ThemeColors.accent.primary} />
                        : <Users size={16} color={ThemeColors.text.muted} />
                      }
                    </Pressable>
                  </View>

                  <View className="w-24">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Guests</Text>
                    <TextInput
                      value={guestCount}
                      onChangeText={setGuestCount}
                      keyboardType="number-pad"
                      className="rounded-sm border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                  </View>
                </View>

                {/* Date + Time — create mode only */}
                {!isEditMode && (
                  <View className="mb-4 flex-row gap-3">
                    <View className="flex-1">
                      <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                        Date <Text className="text-pos-danger">*</Text>
                      </Text>
                      <Pressable
                        onPress={() => { setShowTimePicker(false); setShowDatePicker((v) => !v); }}
                        className="flex-row items-center gap-2 rounded-sm border border-border bg-surface px-4 py-3"
                      >
                        <CalendarDays size={16} color={ThemeColors.accent.primary} />
                        <Text className="text-pos-base text-pos-text">
                          {reservationDateTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </Pressable>
                    </View>
                    <View className="w-28">
                      <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">
                        Time <Text className="text-pos-danger">*</Text>
                      </Text>
                      <Pressable
                        onPress={() => { setShowDatePicker(false); setShowTimePicker((v) => !v); }}
                        className="flex-row items-center gap-2 rounded-sm border border-border bg-surface px-4 py-3"
                      >
                        <Clock size={16} color={ThemeColors.accent.primary} />
                        <Text className="font-mono text-pos-base text-pos-text">
                          {`${String(reservationDateTime.getHours()).padStart(2, '0')}:${String(reservationDateTime.getMinutes()).padStart(2, '0')}`}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Native date/time pickers */}
                {!isEditMode && showDatePicker && (
                  <View className="mb-4">
                    <DateTimePicker
                      value={reservationDateTime}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      minimumDate={nowAppLocalDate()}
                      onChange={(_e, date) => {
                        if (Platform.OS === 'android') setShowDatePicker(false);
                        if (date) {
                          setReservationDateTime((prev) => {
                            const next = new Date(date);
                            next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                            return next;
                          });
                        }
                      }}
                    />
                  </View>
                )}

                {!isEditMode && showTimePicker && (
                  <View className="mb-4">
                    <DateTimePicker
                      value={reservationDateTime}
                      mode="time"
                      is24Hour
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_e, date) => {
                        if (Platform.OS === 'android') setShowTimePicker(false);
                        if (date) {
                          setReservationDateTime((prev) => {
                            const next = new Date(prev);
                            next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                            return next;
                          });
                        }
                      }}
                    />
                  </View>
                )}

                {/* Duration */}
                {!isEditMode && (
                  <View className="mb-4">
                    <Text className="mb-1.5 text-pos-sm font-medium text-pos-text-muted">Duration (minutes)</Text>
                    <TextInput
                      value={durationMinutes}
                      onChangeText={setDurationMinutes}
                      keyboardType="number-pad"
                      className="rounded-sm border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    />
                    {endTimePreview && (
                      <View className="mt-1.5 flex-row items-center gap-1">
                        <Clock size={12} color={ThemeColors.text.muted} />
                        <Text className="font-mono text-pos-xs text-pos-text-muted">
                          Ends at {endTimePreview}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

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
                    className="rounded-sm border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                    style={{ minHeight: 72 }}
                  />
                </View>

                {/* Submit */}
                <Button onPress={handleSubmit} disabled={isSubmitting} className="rounded-sm bg-brand py-4">
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-center text-pos-base font-bold text-white">
                      {isEditMode ? 'Save Changes' : 'Create Reservation'}
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

// ─── Table Picker Modal ───────────────────────────────────────────────────────

interface TablePickerModalProps {
  visible: boolean;
  floorAreas: { id: number | string; name: string }[];
  getTablesForArea: (areaId: number) => TableWithOrder[];
  selectedTableId: number | null;
  onSelect: (tableId: number) => void;
  onClose: () => void;
}

function TablePickerModal({ visible, floorAreas, getTablesForArea, selectedTableId, onSelect, onClose }: TablePickerModalProps) {
  const [activeAreaId, setActiveAreaId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && floorAreas.length > 0 && activeAreaId === null) {
      setActiveAreaId(toInt(floorAreas[0].id));
    }
  }, [visible, floorAreas, activeAreaId]);

  const areaId = activeAreaId ?? (floorAreas.length > 0 ? toInt(floorAreas[0].id) : null);
  const areaTablesRaw = areaId !== null ? getTablesForArea(areaId) : [];
  const areaTables = areaTablesRaw.filter((t) => t.status !== TABLE_STATUS.MAINTENANCE);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="rounded-t-xl bg-surface-card" style={{ maxHeight: '70%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
            <Text className="text-pos-lg font-bold text-pos-text">Select Table</Text>
            <Pressable onPress={onClose} className="p-1">
              <X size={22} color={ThemeColors.text.muted} />
            </Pressable>
          </View>

          {/* Area tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-border">
            <View className="flex-row px-4 py-2 gap-2">
              {floorAreas.map((area) => {
                const aid = toInt(area.id);
                const isActive = areaId === aid;
                return (
                  <Pressable
                    key={area.id}
                    onPress={() => setActiveAreaId(aid)}
                    className={`rounded-sm px-4 py-2 ${isActive ? 'bg-brand' : 'bg-surface-raised'}`}
                  >
                    <Text className={`text-pos-sm font-semibold ${isActive ? 'text-white' : 'text-pos-text-muted'}`}>
                      {area.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Table grid */}
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {areaTables.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-pos-sm text-pos-text-muted">No available tables in this area</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3">
                {areaTables.map((t) => {
                  const tid = toInt(t.id);
                  const isSelected = selectedTableId === tid;
                  const isAvailable = t.status === TABLE_STATUS.AVAILABLE;
                  const isReserved = t.status === TABLE_STATUS.RESERVED;
                  const isOccupied = t.status === TABLE_STATUS.OCCUPIED;

                  let borderColor = 'border-border';
                  let bgColor = 'bg-surface';
                  let statusDot = 'bg-pos-text-muted';
                  let statusLabel = t.status as string;

                  if (isSelected) {
                    borderColor = 'border-brand';
                    bgColor = 'bg-brand/10';
                  }
                  if (isAvailable) {
                    statusDot = 'bg-status-available';
                    statusLabel = 'Available';
                  } else if (isReserved) {
                    statusDot = 'bg-status-reserved';
                    statusLabel = 'Reserved';
                  } else if (isOccupied) {
                    statusDot = 'bg-status-occupied';
                    statusLabel = 'Occupied';
                  }

                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => onSelect(tid)}
                      className={`rounded-sm border p-3 items-center ${borderColor} ${bgColor}`}
                      style={{ width: '30%' }}
                    >
                      {isSelected && (
                        <View className="absolute top-1.5 right-1.5">
                          <Check size={13} color={ThemeColors.accent.primary} />
                        </View>
                      )}
                      <Text className={`font-mono text-pos-lg font-bold ${isSelected ? 'text-brand' : 'text-pos-text'}`}>
                        {t.table_number}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-1">
                        <View className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                        <Text className="text-pos-xs text-pos-text-muted">{statusLabel}</Text>
                      </View>
                      <Text className="font-mono text-pos-xs text-pos-text-muted mt-0.5">cap {t.capacity}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View className={`rounded-sm px-4 py-2 items-center min-w-[72px] ${bg}`}>
      <Text className={`font-mono text-pos-lg font-bold ${color}`}>{value}</Text>
      <Text className="text-pos-xs text-pos-text-muted">{label}</Text>
    </View>
  );
}

// ─── Reservation Row ──────────────────────────────────────────────────────────

interface ReservationRowProps {
  reservation: ReservationWithCustomer;
  tableName: string;
  formattedTime: string;
  endTime: string;
  onStatusAction: (reservation: ReservationWithCustomer, status: ReservationStatus) => void;
  onEdit: () => void;
}

function ReservationRow({ reservation, tableName, formattedTime, endTime, onStatusAction, onEdit }: ReservationRowProps) {
  const status = reservation.status as ReservationStatus;
  const isConfirmed = status === RESERVATION_STATUS.CONFIRMED;
  const isSeated = status === RESERVATION_STATUS.SEATED;
  const isActive = isConfirmed || isSeated;

  return (
    <View className="mb-2 rounded-sm border border-border bg-surface-card overflow-hidden">
      {/* Left accent bar */}
      <View className={`absolute left-0 top-0 bottom-0 w-1 ${
        isConfirmed ? 'bg-brand' : isSeated ? 'bg-status-available' : 'bg-surface-raised'
      }`} />

      <View className="px-4 pt-3 pb-2 pl-5">
        {/* Top row: name + status + edit */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-pos-base font-bold text-pos-text" numberOfLines={1}>
              {reservation.resolved_customer_name}
            </Text>
            {reservation.customer_phone ? (
              <Text className="text-pos-xs text-pos-text-muted mt-0.5">{reservation.customer_phone}</Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            <StatusBadge status={status} />
            {isActive && (
              <Pressable onPress={onEdit} className="p-1 rounded-sm active:bg-surface-raised">
                <Pencil size={15} color={ThemeColors.text.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Info row */}
        <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Clock size={12} color={ThemeColors.text.muted} />
            <Text className="font-mono text-pos-xs text-pos-text-muted">
              {formattedTime} – {endTime}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Users size={12} color={ThemeColors.text.muted} />
            <Text className="text-pos-xs text-pos-text-muted">
              Table <Text className="font-mono">{tableName}</Text> · <Text className="font-mono">{reservation.guest_count}</Text> guest{reservation.guest_count !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {reservation.notes ? (
          <Text className="mt-1.5 text-pos-xs italic text-pos-text-muted" numberOfLines={2}>
            "{reservation.notes}"
          </Text>
        ) : null}

        {/* Action buttons — status-aware per API spec */}
        {isConfirmed && (
          <View className="mt-3 flex-row gap-2 border-t border-border pt-3">
            <Pressable
              onPress={() => onStatusAction(reservation, RESERVATION_STATUS.SEATED)}
              className="flex-1 rounded-sm bg-status-available/20 py-2"
            >
              <Text className="text-center text-pos-sm font-semibold text-status-available">Seat</Text>
            </Pressable>
            <Pressable
              onPress={() => onStatusAction(reservation, RESERVATION_STATUS.NO_SHOW)}
              className="flex-1 rounded-sm bg-surface-raised py-2"
            >
              <Text className="text-center text-pos-sm font-semibold text-pos-text-muted">No Show</Text>
            </Pressable>
            <Pressable
              onPress={() => onStatusAction(reservation, RESERVATION_STATUS.CANCELLED)}
              className="flex-1 rounded-sm bg-pos-danger/10 py-2"
            >
              <Text className="text-center text-pos-sm font-semibold text-pos-danger">Cancel</Text>
            </Pressable>
          </View>
        )}

        {isSeated && (
          <View className="mt-3 border-t border-border pt-3">
            <Pressable
              onPress={() => onStatusAction(reservation, RESERVATION_STATUS.COMPLETED)}
              className="rounded-sm bg-brand/20 py-2"
            >
              <Text className="text-center text-pos-sm font-semibold text-brand">Mark Completed</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
