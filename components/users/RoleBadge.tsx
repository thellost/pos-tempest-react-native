import { Text, View } from 'react-native';

import { ROLE_TYPE } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';

export const ROLE_LABELS: Record<string, string> = {
  [ROLE_TYPE.WAITER]:   'Waiter',
  [ROLE_TYPE.CASHIER]:  'Cashier',
  [ROLE_TYPE.MANAGER]:  'Manager',
  [ROLE_TYPE.ADMIN]:    'Admin',
};

export const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  [ROLE_TYPE.WAITER]:  { bg: ThemeColors.accent.primaryLight,  text: ThemeColors.accent.primary },
  [ROLE_TYPE.CASHIER]: { bg: ThemeColors.success.light,         text: ThemeColors.success.DEFAULT },
  [ROLE_TYPE.MANAGER]: { bg: ThemeColors.warning.muted,         text: ThemeColors.warning.DEFAULT },
  [ROLE_TYPE.ADMIN]:   { bg: ThemeColors.danger.muted,          text: ThemeColors.danger.DEFAULT },
};

interface RoleBadgeProps {
  role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const style = ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS[ROLE_TYPE.WAITER];
  return (
    <View style={{ backgroundColor: style.bg }} className="rounded-md px-2 py-0.5">
      <Text style={{ color: style.text }} className="text-pos-xs font-semibold capitalize">
        {ROLE_LABELS[role] ?? role}
      </Text>
    </View>
  );
}
