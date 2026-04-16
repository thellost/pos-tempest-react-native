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
