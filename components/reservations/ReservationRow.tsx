import { Pressable, Text, View } from 'react-native';

import { Clock, Pencil, Users } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import { RESERVATION_STATUS } from '@/constants/enums';
import type { ReservationStatus } from '@/constants/enums';
import { getReservationStatusStyle } from '@/utils/status-colors';
import type { ReservationWithCustomer } from '@/hooks/use-reservations';

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReservationStatus }) {
  const { bg, text, label } = getReservationStatusStyle(status);
  return (
    <View className={`rounded px-2.5 py-0.5 ${bg}`}>
      <Text className={`text-[11px] font-semibold ${text}`}>{label}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ReservationRowProps {
  reservation: ReservationWithCustomer;
  tableName: string;
  formattedTime: string;
  endTime: string;
  onStatusAction: (reservation: ReservationWithCustomer, status: ReservationStatus) => void;
  onEdit: () => void;
}

export function ReservationRow({
  reservation,
  tableName,
  formattedTime,
  endTime,
  onStatusAction,
  onEdit,
}: ReservationRowProps) {
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
            &ldquo;{reservation.notes}&rdquo;
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
