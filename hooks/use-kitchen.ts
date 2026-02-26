import { useQuery } from '@powersync/react';
import { useCallback } from 'react';

import type { KotStatus } from '@/constants/enums';
import { KOT_STATUS } from '@/constants/enums';
import { updateKOTStatus } from '@/services/kitchen.service';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Flat KOT row returned by the reactive query (no nested items — items are
 *  loaded per-card in KOTCard to stay reactive). */
export interface KOTRow {
  id: number | string;
  order_id: number | string;
  ticket_number: string;
  status: string;
  priority: number | string;
  round_number: number | string;
  created_at: string;
  table_number: string | null;
  order_number: string;
  order_type: string;
}

// ─── useKitchen ───────────────────────────────────────────────────────────────

/**
 * Provides reactive KOT columns for the Kitchen Display System.
 * Each column (pending / in_progress / ready) is a live-updating list.
 */
export function useKitchen() {
  const { data: allKOTs, isLoading } = useQuery<KOTRow>(
    `SELECT kot.id, kot.order_id, kot.ticket_number, kot.status,
            kot.priority, kot.round_number, kot.created_at,
            t.table_number, o.order_number, o.order_type
     FROM kitchen_order_tickets kot
     JOIN orders o ON o.id = kot.order_id
     LEFT JOIN tables t ON t.id = o.table_id
     WHERE kot.status IN (?, ?, ?)
     ORDER BY kot.priority DESC, kot.created_at ASC`,
    [KOT_STATUS.PENDING, KOT_STATUS.IN_PROGRESS, KOT_STATUS.READY]
  );

  const pendingKOTs = (allKOTs ?? []).filter(
    (k) => k.status === KOT_STATUS.PENDING
  );
  const inProgressKOTs = (allKOTs ?? []).filter(
    (k) => k.status === KOT_STATUS.IN_PROGRESS
  );
  const readyKOTs = (allKOTs ?? []).filter(
    (k) => k.status === KOT_STATUS.READY
  );

  /**
   * Advances a KOT to the next lifecycle state:
   *   PENDING → IN_PROGRESS → READY → SERVED
   */
  const advanceKOT = useCallback(
    async (kotId: number, currentStatus: KotStatus) => {
      const next: Partial<Record<KotStatus, KotStatus>> = {
        [KOT_STATUS.PENDING]: KOT_STATUS.IN_PROGRESS,
        [KOT_STATUS.IN_PROGRESS]: KOT_STATUS.READY,
        [KOT_STATUS.READY]: KOT_STATUS.SERVED,
      };
      const nextStatus = next[currentStatus];
      if (nextStatus) {
        await updateKOTStatus(kotId, nextStatus);
      }
    },
    []
  );

  return {
    pendingKOTs,
    inProgressKOTs,
    readyKOTs,
    isLoading,
    advanceKOT,
  };
}
