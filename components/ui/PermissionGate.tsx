import type React from 'react';

import type { Permission } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';

interface PermissionGateProps {
  /** Single permission required */
  permission?: Permission;
  /** Multiple permissions. Combined with requireAll. */
  permissions?: Permission[];
  /** If true, user must have ALL listed permissions. Default: false (any suffices). */
  requireAll?: boolean;
  /** Rendered when permission check fails. Default: null (renders nothing). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps): React.ReactNode {
  const { canAll, canAny } = usePermissions();

  const combined: Permission[] = [
    ...(permission ? [permission] : []),
    ...(permissions ?? []),
  ];

  if (combined.length === 0) {
    return children;
  }

  const allowed = requireAll ? canAll(combined) : canAny(combined);

  return allowed ? children : fallback;
}
