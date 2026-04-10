import { useMemo } from 'react';

import { ROLE_TYPE } from '@/constants/enums';
import { hasPermission } from '@/constants/permissions';
import type { Permission } from '@/constants/permissions';
import { useAuth } from '@/hooks/use-auth';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role_name ?? '';

  return useMemo(() => {
    const can = (permission: Permission): boolean => hasPermission(role, permission);
    const canAll = (permissions: Permission[]): boolean => permissions.every((p) => hasPermission(role, p));
    const canAny = (permissions: Permission[]): boolean => permissions.some((p) => hasPermission(role, p));

    return {
      can,
      canAll,
      canAny,
      role,
      isWaiter: role === ROLE_TYPE.WAITER,
      isCashier: role === ROLE_TYPE.CASHIER,
      isManager: role === ROLE_TYPE.MANAGER,
      isAdmin: role === ROLE_TYPE.ADMIN,
      isAtLeastCashier:
        role === ROLE_TYPE.CASHIER || role === ROLE_TYPE.MANAGER || role === ROLE_TYPE.ADMIN,
      isAtLeastManager: role === ROLE_TYPE.MANAGER || role === ROLE_TYPE.ADMIN,
    };
  }, [role]);
}
