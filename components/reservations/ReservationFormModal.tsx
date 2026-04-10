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
import { CalendarDays, Check, Clock, Users, X } from 'lucide-react-native';

import { Button, IconButton } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { TABLE_STATUS } from '@/constants/enums';
import type { CreateReservationInput, ReservationWithCustomer } from '@/hooks/use-reservations';
import { useCustomers } from '@/hooks/use-customers';
import type { TableWithOrder } from '@/hooks/use-tables';
import { toInt, toIntOrNull } from '@/utils/coerce';
import { isoToPickerDate, nowAppLocalDate, pickerDateToISO } from '@/utils/date';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateReservationPayload {
  guest_count?: number;
  table_id?: number | null;
  notes?: string | null;
}

export interface ReservationFormModalProps {
  visible: boolean;
  editingReservation: ReservationWithCustomer | null;
  tables: TableWithOrder[];
  floorAreas: { id: number | string; name: string }[];
  getTablesForArea: (areaId: number) => TableWithOrder[];
  onClose: () => void;
  onCreate: (input: CreateReservationInput) => Promise<ReservationWithCustomer>;
  onUpdate: (id: number, payload: UpdateReservationPayload) => Promise<void>;
}

// ─── TablePickerModal ─────────────────────────────────────────────────────────

interface TablePickerModalProps {
  visible: boolean;
  floorAreas: { id: number | string; name: string }[];
  getTablesForArea: (areaId: number) => TableWithOrder[];
  selectedTableId: number | null;
  onSelect: (tableId: number) => void;
  onClose: () => void;
}

function TablePickerModal({
  visible,
  floorAreas,
  getTablesForArea,
  selectedTableId,
  onSelect,
  onClose,
}: TablePickerModalProps) {
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

// ─── ReservationFormModal ─────────────────────────────────────────────────────

function defaultDateTime(): Date {
  const d = nowAppLocalDate();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

export function ReservationFormModal({
  visible,
  editingReservation,
  tables,
  floorAreas,
  getTablesForArea,
  onClose,
  onCreate,
  onUpdate,
}: ReservationFormModalProps) {
  const { customers, setSearchQuery } = useCustomers();

  const isEditMode = editingReservation !== null;

  // Form field state — initialized fresh on each mount
  const [guestName, setGuestName] = useState(() =>
    editingReservation ? editingReservation.resolved_customer_name : ''
  );
  const [guestPhone, setGuestPhone] = useState(() =>
    editingReservation ? (editingReservation.customer_phone ?? '') : ''
  );
  const [guestCount, setGuestCount] = useState(() =>
    editingReservation ? String(editingReservation.guest_count) : '2'
  );
  const [reservationDateTime, setReservationDateTime] = useState<Date>(() =>
    editingReservation ? isoToPickerDate(editingReservation.reservation_datetime) : defaultDateTime()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(() =>
    editingReservation ? String(editingReservation.duration_minutes) : '120'
  );
  const [notes, setNotes] = useState(() =>
    editingReservation ? (editingReservation.notes ?? '') : ''
  );
  const [selectedTableId, setSelectedTableId] = useState<number | null>(() =>
    editingReservation ? toIntOrNull(editingReservation.table_id) : null
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(() =>
    editingReservation ? toIntOrNull(editingReservation.customer_id) : null
  );
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTable = selectedTableId
    ? tables.find((t) => toInt(t.id) === selectedTableId) ?? null
    : null;
  const selectedTableLabel = selectedTable
    ? `${selectedTable.floor_area_name ? `${selectedTable.floor_area_name} · ` : ''}Table ${selectedTable.table_number}`
    : null;

  const endTimePreview = useMemo(() => {
    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur)) return null;
    const totalMin = reservationDateTime.getHours() * 60 + reservationDateTime.getMinutes() + dur;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [reservationDateTime, durationMinutes]);

  const handleSubmit = useCallback(async () => {
    if (isEditMode && editingReservation) {
      const count = parseInt(guestCount, 10);
      if (isNaN(count) || count < 1) {
        Alert.alert('Validation', 'Guest count must be at least 1.');
        return;
      }
      setIsSubmitting(true);
      try {
        await onUpdate(toInt(editingReservation.id), {
          guest_count: count,
          table_id: selectedTableId,
          notes: notes.trim() || null,
        });
        onClose();
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
      await onCreate({
        table_id: selectedTableId,
        customer_id: selectedCustomerId,
        customer_name: guestName.trim(),
        customer_phone: guestPhone.trim() || null,
        guest_count: count,
        reservation_datetime: isoDatetime,
        duration_minutes: parseInt(durationMinutes, 10) || 120,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create reservation.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isEditMode,
    editingReservation,
    guestCount,
    guestName,
    guestPhone,
    selectedTableId,
    selectedCustomerId,
    reservationDateTime,
    durationMinutes,
    notes,
    onClose,
    onCreate,
    onUpdate,
  ]);

  if (!visible) return null;

  return (
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
            <IconButton onPress={onClose}>
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

      {/* Table Picker Modal */}
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
    </View>
  );
}
