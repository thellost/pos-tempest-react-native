import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { CalendarDays, Plus, WifiOff } from 'lucide-react-native';

import { Button } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { RESERVATION_STATUS } from '@/constants/enums';
import type { ReservationStatus } from '@/constants/enums';
import { useOnlineCheck } from '@/hooks/use-online-check';
import { useReservations } from '@/hooks/use-reservations';
import type { ReservationWithCustomer } from '@/hooks/use-reservations';
import { useTables } from '@/hooks/use-tables';
import { toInt, toIntOrNull } from '@/utils/coerce';
import { getAppDateString } from '@/utils/date';
import { getAppTimezone } from '@/utils/timezone';
import { getReservationStatusStyle } from '@/utils/status-colors';
import {
  ReservationFilters,
  DATE_FILTER_LABELS,
} from '@/components/reservations/ReservationFilters';
import type { DateFilter, StatusFilter } from '@/components/reservations/ReservationFilters';
import { ReservationStatsBar } from '@/components/reservations/ReservationStatsBar';
import { ReservationRow } from '@/components/reservations/ReservationRow';
import { ReservationFormModal } from '@/components/reservations/ReservationFormModal';

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

  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Form visibility state
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<ReservationWithCustomer | null>(null);

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingReservation(null);
    setShowForm(true);
  };

  const handleOpenEdit = (reservation: ReservationWithCustomer) => {
    setEditingReservation(reservation);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingReservation(null);
  };

  const handleStatusAction = (reservation: ReservationWithCustomer, status: ReservationStatus) => {
    const { label: statusLabel } = getReservationStatusStyle(status);
    Alert.alert(
      `Mark as ${statusLabel}`,
      `Set ${reservation.resolved_customer_name} to ${statusLabel}?`,
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

        <ReservationStatsBar
          todayCount={todayCount}
          confirmedCount={confirmedCount}
          seatedCount={seatedCount}
          weekCount={weekCount}
        />

        <ReservationFilters
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
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

      {/* ── Create / Edit Form ─────────────────────────────────────────────── */}
      {showForm && (
        <ReservationFormModal
          visible={showForm}
          editingReservation={editingReservation}
          tables={tables}
          floorAreas={floorAreas}
          getTablesForArea={getTablesForArea}
          onClose={handleCloseForm}
          onCreate={createReservation}
          onUpdate={updateReservation}
        />
      )}
    </View>
  );
}
