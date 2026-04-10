import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { CalendarDays, CheckCircle, X, XCircle } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import type { ReservationStatus } from '@/constants/enums';
import { RESERVATION_STATUS } from '@/constants/enums';
import type { ReservationWithCustomer } from '@/hooks/use-reservations';
import { Button } from '@/components/ui';

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

interface ReservationListViewProps {
  tableReservations: ReservationWithCustomer[];
  onCreateNew: () => void;
  onStatusChange: (res: ReservationWithCustomer, status: ReservationStatus) => void;
  formatReservationTime: (datetime: string) => string;
}

export function ReservationListView({
  tableReservations,
  onCreateNew,
  onStatusChange,
  formatReservationTime,
}: ReservationListViewProps) {
  const confirmStatusChange = (res: ReservationWithCustomer, newStatus: ReservationStatus) => {
    const label = STATUS_LABELS[newStatus];
    Alert.alert(
      'Update Reservation',
      `Mark reservation for ${res.resolved_customer_name} as ${label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: label, onPress: () => onStatusChange(res, newStatus) },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-pos-lg font-semibold text-pos-text">
          {tableReservations.length === 0
            ? 'No active reservations'
            : `${tableReservations.length} reservation${tableReservations.length > 1 ? 's' : ''}`}
        </Text>
        <Button
          onPress={onCreateNew}
          className="flex-row items-center justify-center rounded-xl bg-brand px-4 py-2.5"
        >
          <Text className="text-pos-sm font-bold text-white">+ New Reservation</Text>
        </Button>
      </View>

      {tableReservations.length === 0 ? (
        <View className="items-center py-10">
          <CalendarDays size={36} color={ThemeColors.text.muted} />
          <Text className="mt-3 text-pos-base text-pos-text-muted">
            No reservations for this table
          </Text>
          <Button
            onPress={onCreateNew}
            className="mt-4 items-center justify-center rounded-xl bg-brand px-6 py-3"
          >
            <Text className="text-pos-base font-bold text-white">Create Reservation</Text>
          </Button>
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
                <Button
                  onPress={() => confirmStatusChange(res, RESERVATION_STATUS.SEATED)}
                  className="flex-1 items-center justify-center rounded-xl bg-status-available/20 py-2.5"
                >
                  <View className="flex-row items-center gap-1.5">
                    <CheckCircle size={14} color={ThemeColors.success.DEFAULT} />
                    <Text className="text-pos-sm font-semibold text-status-available">Seated</Text>
                  </View>
                </Button>
                <Button
                  onPress={() => confirmStatusChange(res, RESERVATION_STATUS.NO_SHOW)}
                  className="flex-1 items-center justify-center rounded-xl bg-pos-warning/20 py-2.5"
                >
                  <View className="flex-row items-center gap-1.5">
                    <XCircle size={14} color={ThemeColors.warning.DEFAULT} />
                    <Text className="text-pos-sm font-semibold text-pos-warning">No Show</Text>
                  </View>
                </Button>
                <Button
                  onPress={() => confirmStatusChange(res, RESERVATION_STATUS.CANCELLED)}
                  className="flex-1 items-center justify-center rounded-xl bg-pos-danger/20 py-2.5"
                >
                  <View className="flex-row items-center gap-1.5">
                    <X size={14} color={ThemeColors.danger.DEFAULT} />
                    <Text className="text-pos-sm font-semibold text-pos-danger">Cancel</Text>
                  </View>
                </Button>
              </View>
            )}
            {res.status === RESERVATION_STATUS.SEATED && (
              <View className="mt-3 flex-row gap-2">
                <Button
                  onPress={() => confirmStatusChange(res, RESERVATION_STATUS.COMPLETED)}
                  className="flex-1 items-center justify-center rounded-xl bg-surface-raised py-2.5"
                >
                  <Text className="text-pos-sm font-semibold text-pos-text-muted">
                    Mark Completed
                  </Text>
                </Button>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
