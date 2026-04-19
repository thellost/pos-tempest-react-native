import { powersync } from '@/db/provider';

/**
 * Updates the auto-shift schedule fields for a branch.
 * @param branchId - The branch ID to update
 * @param openingTime - 24h HH:MM opening time
 * @param closingTime - 24h HH:MM closing time
 * @param autoShift - Whether the scheduler manages shifts automatically
 */
export async function updateBranchSchedule(
  branchId: number,
  openingTime: string,
  closingTime: string,
  autoShift: boolean,
): Promise<void> {
  try {
    await powersync.execute(
      `UPDATE branches SET opening_time = ?, closing_time = ?, auto_shift = ?, updated_at = ? WHERE id = ?`,
      [openingTime, closingTime, autoShift ? 1 : 0, new Date().toISOString(), branchId],
    );
  } catch (error) {
    console.error('[BranchService] Failed to update branch schedule:', error);
    throw new Error('Failed to save branch schedule.');
  }
}

/**
 * Updates the rounding precision for a branch.
 * @param branchId - The branch ID to update
 * @param precision - Rounding unit (1=exact, 10=tens, 100=hundreds, 1000=thousands)
 */
export async function updateBranchRoundingPrecision(
  branchId: number,
  precision: number,
): Promise<void> {
  try {
    await powersync.execute(
      `UPDATE branches SET rounding_precision = ?, updated_at = ? WHERE id = ?`,
      [precision, new Date().toISOString(), branchId],
    );
  } catch (error) {
    console.error('[BranchService] Failed to update rounding precision:', error);
    throw new Error('Failed to save rounding precision.');
  }
}
