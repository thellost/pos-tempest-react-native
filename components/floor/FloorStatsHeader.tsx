import { Text, View } from 'react-native';

import { ShoppingBag } from 'lucide-react-native';

import { Button } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';

interface FloorStatsHeaderProps {
  availableTablesCount: number;
  occupiedTablesCount: number;
  reservedTablesCount: number;
  totalTablesCount: number;
  onTakeawayPress: () => void;
  isPhone: boolean;
}

export function FloorStatsHeader({
  availableTablesCount,
  occupiedTablesCount,
  reservedTablesCount,
  totalTablesCount,
  onTakeawayPress,
  isPhone,
}: FloorStatsHeaderProps) {
  const statCardWidth = isPhone ? 'flex-1' : 'w-24';

  return (
    <View className="border-b border-border bg-surface-card px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-pos-2xl font-bold text-pos-text">Tables & Orders</Text>
        <Button
          onPress={onTakeawayPress}
          className="flex-row items-center rounded-sm bg-amber-500 px-5 py-3"
        >
          <ShoppingBag size={18} color="white" />
          <Text className="ml-2 text-pos-base font-bold text-white">Takeaway</Text>
        </Button>
      </View>
      <View className="mt-3 flex-row items-center gap-2">
        <View className={`${statCardWidth} rounded-sm bg-status-available-muted px-3 py-2 items-center`}>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-status-available" />
            <Text className="text-pos-xs text-pos-text-muted">Available</Text>
          </View>
          <Text className="font-mono text-pos-xl font-bold text-status-available text-center">{availableTablesCount}</Text>
        </View>
        <View className={`${statCardWidth} rounded-sm bg-status-occupied-muted px-3 py-2 items-center`}>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-status-occupied" />
            <Text className="text-pos-xs text-pos-text-muted">Occupied</Text>
          </View>
          <Text className="font-mono text-pos-xl font-bold text-status-occupied text-center">{occupiedTablesCount}</Text>
        </View>
        <View className={`${statCardWidth} rounded-sm bg-status-reserved-muted px-3 py-2 items-center`}>
          <View className="flex-row items-center gap-1">
            <View className="h-2 w-2 rounded-full bg-status-reserved" />
            <Text className="text-pos-xs text-pos-text-muted">Reserved</Text>
          </View>
          <Text className="font-mono text-pos-xl font-bold text-status-reserved text-center">{reservedTablesCount}</Text>
        </View>
        <View className={`${statCardWidth} rounded-sm bg-surface-raised px-3 py-2 items-center`}>
          <Text className="text-pos-xs text-pos-text-muted">Total</Text>
          <Text className="font-mono text-pos-xl font-bold text-pos-text text-center">{totalTablesCount}</Text>
        </View>
      </View>
    </View>
  );
}
