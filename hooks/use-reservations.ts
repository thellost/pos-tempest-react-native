import { useQuery } from '@powersync/react';
import { useCallback } from 'react';

import type { ReservationStatus } from '@/constants/enums';
import { RESERVATION_STATUS } from '@/constants/enums';
import { toIntOrNull } from '@/utils/coerce';
import { getAppTimezone } from '@/utils/timezone';
import type { Reservation } from '@/db/models';
import { powersync } from '@/db/provider';
import { useAuth } from './use-auth';

/**
 * Reservation with optional customer name resolved from the customers table.
 */
export interface ReservationWithCustomer extends Omit<Reservation, 'id'> {
  id: number;
  resolved_customer_name: string;
}

/**
 * Input required to create a new reservation.
 * Table must belong to the device's branch (enforced by the hook).
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
 * Only tables belonging to the authenticated user's branch are queried.
 */
export function useReservations() {
  const { user } = useAuth();
  const branchId = user?.branch_id ?? 0;

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
    [branchId, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.SEATED]
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
    [branchId]
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
    [activeReservations]
  );

  /**
   * Creates a new reservation. Enforces branchId from the authenticated user.
   */
  const createReservation = useCallback(
    async (input: CreateReservationInput): Promise<ReservationWithCustomer> => {
      if (!user?.id) throw new Error('Must be authenticated to create a reservation.');
      if (!input.customer_name?.trim()) throw new Error('Customer name is required.');
      if (!input.reservation_datetime) throw new Error('Reservation date/time is required.');
      if (input.guest_count < 1) throw new Error('Guest count must be at least 1.');

      const maxIdRow = await powersync.getOptional<{ max_id: number }>(
        `SELECT MAX(CAST(id AS INTEGER)) as max_id FROM reservations`
      );
      const newId = ((maxIdRow?.max_id ?? 0) + 1).toString();
      const now = new Date().toISOString();

      await powersync.execute(
        `INSERT INTO reservations (
          id, branch_id, table_id, customer_id, customer_name, customer_phone,
          guest_count, reservation_datetime, duration_minutes, status,
          notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          branchId,
          input.table_id,
          input.customer_id ?? null,
          input.customer_name.trim(),
          input.customer_phone?.trim() ?? null,
          input.guest_count,
          input.reservation_datetime,
          input.duration_minutes ?? 90,
          RESERVATION_STATUS.CONFIRMED,
          input.notes?.trim() ?? null,
          user.id,
          now,
          now,
        ]
      );

      // Update table status to reserved
      await powersync.execute(
        `UPDATE tables SET status = ?, updated_at = ? WHERE id = ?`,
        ['reserved', now, input.table_id]
      );

      const created = await powersync.getOptional<ReservationWithCustomer>(
        `SELECT r.*, COALESCE(c.name, r.customer_name) AS resolved_customer_name
         FROM reservations r
         LEFT JOIN customers c ON c.id = r.customer_id
         WHERE r.id = ?`,
        [newId]
      );
      if (!created) throw new Error('Failed to retrieve created reservation.');
      return created;
    },
    [user, branchId]
  );

  /**
   * Updates the status of a reservation.
   * When marking as SEATED, the table status is set to OCCUPIED (order creation handles that too).
   * When marking as COMPLETED / NO_SHOW / CANCELLED, the table is freed back to AVAILABLE
   * (only if no other active reservation claims it).
   */
  const updateReservationStatus = useCallback(
    async (reservationId: number, status: ReservationStatus): Promise<void> => {
      const now = new Date().toISOString();

      // Fetch the reservation to get the table_id
      const reservation = await powersync.getOptional<Reservation>(
        `SELECT * FROM reservations WHERE id = ?`,
        [reservationId]
      );
      if (!reservation) throw new Error('Reservation not found.');

      await powersync.execute(
        `UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?`,
        [status, now, reservationId]
      );

      const tableId = typeof reservation.table_id === 'string'
        ? parseInt(reservation.table_id as string, 10)
        : reservation.table_id;

      if (tableId) {
        const terminalStatuses: ReservationStatus[] = [
          RESERVATION_STATUS.COMPLETED,
          RESERVATION_STATUS.NO_SHOW,
          RESERVATION_STATUS.CANCELLED,
        ];

        if (terminalStatuses.includes(status)) {
          // Check if any other confirmed reservation still holds this table
          const otherActive = await powersync.getOptional<{ id: number }>(
            `SELECT id FROM reservations
             WHERE table_id = ? AND id != ? AND status IN (?, ?)
             LIMIT 1`,
            [tableId, reservationId, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.SEATED]
          );

          if (!otherActive) {
            // Free the table only if no active order is using it
            const activeOrder = await powersync.getOptional<{ id: number }>(
              `SELECT id FROM orders
               WHERE table_id = ? AND status NOT IN ('completed','cancelled','served')
               LIMIT 1`,
              [tableId]
            );
            if (!activeOrder) {
              await powersync.execute(
                `UPDATE tables SET status = 'available', updated_at = ? WHERE id = ?`,
                [now, tableId]
              );
            }
          }
        }
      }
    },
    []
  );

  /**
   * Updates editable fields of a reservation (guest_count, table_id, notes).
   * Corresponds to PUT /api/v1/reservations/:id.
   */
  const updateReservation = useCallback(
    async (reservationId: number, payload: {
      guest_count?: number;
      table_id?: number | null;
      notes?: string | null;
    }): Promise<void> => {
      const now = new Date().toISOString();
      const parts: string[] = [];
      const values: unknown[] = [];

      if (payload.guest_count !== undefined) {
        parts.push('guest_count = ?');
        values.push(payload.guest_count);
      }
      if (payload.table_id !== undefined) {
        parts.push('table_id = ?');
        values.push(payload.table_id);
      }
      if (payload.notes !== undefined) {
        parts.push('notes = ?');
        values.push(payload.notes);
      }
      if (parts.length === 0) return;

      parts.push('updated_at = ?');
      values.push(now);
      values.push(reservationId);

      await powersync.execute(
        `UPDATE reservations SET ${parts.join(', ')} WHERE id = ?`,
        values
      );
    },
    []
  );

  /**
   * Deletes a reservation (hard delete — not recommended; prefer updateReservationStatus to CANCELLED).
   */
  const deleteReservation = useCallback(
    async (reservationId: number): Promise<void> => {
      await updateReservationStatus(reservationId, RESERVATION_STATUS.CANCELLED);
    },
    [updateReservationStatus]
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
