import { useQuery } from '@powersync/react';
import { useCallback, useState } from 'react';

import { powersync } from '@/db/provider';
import { useDevice } from '@/hooks/use-device';

export interface UserWithRole {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role_id: number;
  role_name: string;
  branch_id: number;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

/**
 * Hook for listing and managing branch staff accounts.
 * Reads from the local PowerSync cache (users + roles JOIN).
 */
export function useUsers() {
  const { registration } = useDevice();
  const branchId = registration?.branch?.id ?? 0;

  const { data: users = [], isLoading } = useQuery<UserWithRole>(
    `SELECT u.id, u.name, u.email, u.phone, u.role_id,
            r.name AS role_name, u.branch_id,
            u.is_active, u.last_login_at, u.created_at
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.branch_id = ?
     ORDER BY r.name ASC, u.name ASC`,
    [branchId]
  );

  const [isUpdating, setIsUpdating] = useState(false);

  /**
   * Activates or deactivates a user account locally.
   * The PowerSync connector will sync this change to Supabase.
   */
  const setActive = useCallback(async (userId: number, active: boolean): Promise<void> => {
    setIsUpdating(true);
    try {
      const now = new Date().toISOString();
      await powersync.execute(
        `UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?`,
        [active ? 1 : 0, now, userId]
      );
    } catch (error) {
      console.error('[useUsers] Error toggling active state:', error);
      throw new Error('Failed to update user status.');
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    users,
    isLoading,
    isUpdating,
    setActive,
    branchId,
  };
}
