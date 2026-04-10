import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { X } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { IconButton } from '@/components/ui';
import type { ReservationStatus } from '@/constants/enums';
import { useCustomers } from '@/hooks/use-customers';
import { useReservations, type ReservationWithCustomer } from '@/hooks/use-reservations';
import type { TableWithOrder } from '@/hooks/use-tables';
import { toInt } from '@/utils/coerce';

import { ReservationForm } from './ReservationForm';
import { ReservationListView } from './ReservationListView';

interface ReservationModalProps {
  visible: boolean;
  table: TableWithOrder | null;
  onClose: () => void;
}

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

  const handleStatusChange = useCallback(
    async (reservation: ReservationWithCustomer, newStatus: ReservationStatus) => {
      try {
        await updateReservationStatus(toInt(reservation.id), newStatus);
      } catch (err) {
        Alert.alert('Error', 'Failed to update reservation status.');
      }
    },
    [updateReservationStatus]
  );

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
            <IconButton
              size="lg"
              onPress={onClose}
              className="rounded-full bg-surface-raised"
            >
              <X size={18} color={ThemeColors.text.muted} />
            </IconButton>
          </View>

          {view === 'list' ? (
            <ReservationListView
              tableReservations={tableReservations}
              onCreateNew={() => setView('create')}
              onStatusChange={handleStatusChange}
              formatReservationTime={formatReservationTime}
            />
          ) : (
            <ReservationForm
              guestName={guestName}
              setGuestName={setGuestName}
              guestPhone={guestPhone}
              setGuestPhone={setGuestPhone}
              guestCount={guestCount}
              setGuestCount={setGuestCount}
              reservationDate={reservationDate}
              setReservationDate={setReservationDate}
              reservationTime={reservationTime}
              setReservationTime={setReservationTime}
              durationMinutes={durationMinutes}
              setDurationMinutes={setDurationMinutes}
              notes={notes}
              setNotes={setNotes}
              selectedCustomerId={selectedCustomerId}
              setSelectedCustomerId={setSelectedCustomerId}
              customers={customers}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onBack={() => setView('list')}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
