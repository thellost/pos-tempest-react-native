import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';
import type { Purchase } from '@/hooks/use-purchases';
import { formatIDR } from '@/utils/currency';
import { POStatusBadge } from './POStatusBadge';

// ─── POListItem ───────────────────────────────────────────────────────────────

export interface POListItemProps {
  po: Purchase;
  onPress: () => void;
}

export function POListItem({ po, onPress }: POListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-sm border border-border bg-surface-card px-4 py-3"
    >
      <View className="flex-1">
        <Text className="font-mono text-pos-base font-bold text-pos-text">{po.purchase_number}</Text>
        <Text className="text-pos-xs text-pos-text-muted">{po.supplier_name}</Text>
      </View>
      <Text className="font-mono text-pos-base font-bold text-pos-text">{formatIDR(po.total)}</Text>
      <POStatusBadge status={po.status} />
      <ChevronRight size={16} color={ThemeColors.text.faint} />
    </Pressable>
  );
}
