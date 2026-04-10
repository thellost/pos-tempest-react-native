import { Text, View } from 'react-native';

import type { PurchaseStatus } from '@/constants/enums';
import { getPOStatusStyle } from '@/utils/status-colors';

interface POStatusBadgeProps {
  status: PurchaseStatus;
}

export function POStatusBadge({ status }: POStatusBadgeProps) {
  const { bg, text, label } = getPOStatusStyle(status);
  return (
    <View className={`rounded-sm px-2 py-1 ${bg}`}>
      <Text className={`text-pos-xs font-bold ${text}`}>{label}</Text>
    </View>
  );
}
