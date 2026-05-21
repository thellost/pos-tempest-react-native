import { useQuery } from '@powersync/react';
import { useCallback } from 'react';

import type { ReservationStatus } from '@/constants/enums';
import { RESERVATION_STATUS } from '@/constants/enums';
import type { Reservation } from '@/db/models';
import { api } from '@/lib/api';
import { addBreadcrumb, captureError } from '@/lib/sentry';
import { toIntOrNull } from '@/utils/coerce';
import { getAppTimezone } from '@/utils/timezone';

import { useAuth } from './use-auth';
import { useDevice } from './use-device';

/**
 * Reservation with optional customer name resolved from the customers table.
 */
export interface ReservationWithCustomer extends Omit<Reservation, 'id'> {
  id: number;
  resolved_customer_name: string;
}

/**
 * Input required to create a new reservation.
 */
export interface CreateReservationInput {
  table_id: number;
  customer_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  guest_count: number;
  /** ISO-8601 datetime string e.g. "2026-03-08T19:00:00.000Z" */
  reservation_datetime: string;
  duration_minutes?: number;
  notes?: string | null;
}

/**
 * Hook for reservation management scoped to the device's branch.
 *
 * Reads are served from the local PowerSync cache (offline-capable).
 * Writes go through the REST API for backend validation (online-only):
 *   - availability conflict checking on create/update
 *   - status transition enforcement
 *   - table status side-effects handled server-side
 */
export function useReservations() {
  const { user } = useAuth();
  const { registration } = useDevice();
  const branchId = registration?.branch?.id ?? 0;

  // All active (non-terminal) reservations for the branch
  const { data: activeReservations = [], isLoading } = useQuery<ReservationWithCustomer>(
    `SELECT
       r.*,
       COALESCE(c.name, r.customer_name) AS resolved_customer_name
     FROM reservations r
     LEFT JOIN customers c ON c.id = r.customer_id
     WHERE r.branch_id = ?
       AND r.status IN (?, ?)
     ORDER BY r.reservation_datetime ASC`,
    [branchId, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.SEATED],
  );

  // All reservations for the branch (for history view)
  const { data: allReservations = [], isLoading: allLoading } = useQuery<ReservationWithCustomer>(
    `SELECT
       r.*,
       COALESCE(c.name, r.customer_name) AS resolved_customer_name
     FROM reservations r
     LEFT JOIN customers c ON c.id = r.customer_id
     WHERE r.branch_id = ?
     ORDER BY r.reservation_datetime DESC
     LIMIT 100`,
    [branchId],
  );

  /**
   * Returns active reservations for a specific table.
   */
  const getReservationsForTable = useCallback(
    (tableId: number): ReservationWithCustomer[] => {
      return activeReservations.filter((r) => {
        const id = toIntOrNull(r.table_id);
        return id === tableId;
      });
    },
    [activeReservations],
  );

  /**
   * Creates a reservation via the API.
   * Backend validates table availability and sets created_by from the JWT.
   * PowerSync syncs the new record back to the local cache automatically.
   */
  const createReservation = useCallback(
    async (input: CreateReservationInput): Promise<ReservationWithCustomer> => {
      if (!user?.id) throw new Error('Must be authenticated to create a reservation.');
      if (!input.customer_name?.trim()) throw new Error('Customer name is required.');
      if (!input.reservation_datetime) throw new Error('Reservation date/time is required.');
      if (input.guest_count < 1) throw new Error('Guest count must be at least 1.');

      try {
        const data = await api.post<Reservation & { resolved_customer_name?: string }>(
          '/api/v1/reservations',
          {
            branch_id: branchId,
            table_id: input.table_id,
            customer_id: input.customer_id ?? null,
            customer_name: input.customer_name.trim(),
            customer_phone: input.customer_phone?.trim() ?? null,
            guest_count: input.guest_count,
            reservation_datetime: input.reservation_datetime,
            duration_minutes: input.duration_minutes ?? 90,
            notes: input.notes?.trim() ?? null,
          },
        );

        addBreadcrumb('reservation', 'Reservation created', { tableId: input.table_id, time: input.reservation_datetime, partySize: input.guest_count });
        return {
          ...data,
          id: Number(data.id),
          resolved_customer_name: data.resolved_customer_name ?? data.customer_name,
        };
      } catch (err) {
        captureError(err, { module: 'reservation', operation: 'createReservation', level: 'error' });
        throw err;
      }
    },
    [user, branchId],
  );

  /**
   * Updates reservation status via the API.
   * Backend enforces valid transitions and handles table status side-effects:
   *   seated    → table becomes occupied
   *   completed / cancelled → table becomes available
   */
  const updateReservationStatus = useCallback(
    async (reservationId: number, status: ReservationStatus): Promise<void> => {
      try {
        await api.patch(`/api/v1/reservations/${reservationId}/status`, { status });
      } catch (err) {
        captureError(err, {
          module: 'reservation',
          operation: 'updateReservationStatus',
          level: 'error',
          extras: { reservationId, status },
        });
        throw err;
      }
    },
    [],
  );

  /**
   * Updates editable fields of a reservation via the API.
   * Backend re-checks table availability if table_id changes.
   */
  const updateReservation = useCallback(
    async (
      reservationId: number,
      payload: {
        guest_count?: number;
        table_id?: number | null;
        notes?: string | null;
      },
    ): Promise<void> => {
      try {
        await api.put(`/api/v1/reservations/${reservationId}`, payload);
      } catch (err) {
        captureError(err, {
          module: 'reservation',
          operation: 'updateReservation',
          level: 'error',
          extras: { reservationId },
        });
        throw err;
      }
    },
    [],
  );

  /**
   * Cancels a reservation (prefer over hard delete).
   */
  const deleteReservation = useCallback(
    async (reservationId: number): Promise<void> => {
      await updateReservationStatus(reservationId, RESERVATION_STATUS.CANCELLED);
    },
    [updateReservationStatus],
  );

  /**
   * Formats a reservation datetime for display.
   */
  const formatReservationTime = useCallback((isoDatetime: string): string => {
    const date = new Date(isoDatetime);
    return date.toLocaleString('id-ID', {
      timeZone: getAppTimezone(),
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, []);

  return {
    activeReservations,
    allReservations,
    isLoading,
    allLoading,
    getReservationsForTable,
    createReservation,
    updateReservation,
    updateReservationStatus,
    deleteReservation,
    formatReservationTime,
  };
}
