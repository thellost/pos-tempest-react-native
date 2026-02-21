import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PRICING_TYPE } from '@/constants/enums';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';

const DEFAULT_BUTTON_COLOR = '#475569';

interface MenuItemCardProps {
  item: MenuItemWithInventory;
  categoryColor?: string | null;
  onPress: () => void;
}

export function MenuItemCard({ item, categoryColor, onPress }: MenuItemCardProps) {
  const isWeightBased = item.pricing_type === PRICING_TYPE.WEIGHT_BASED;
  const isAvailable = Boolean(item.is_available);
  const isLowStock = item.isLowStock;
  const backgroundColor = isAvailable
    ? (categoryColor || DEFAULT_BUTTON_COLOR)
    : '#2A3142';

  const handlePress = useCallback(() => {
    if (isAvailable) {
      onPress();
    }
  }, [isAvailable, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isAvailable}
      className={`overflow-hidden ${!isAvailable ? 'opacity-50' : ''}`}
      style={{ 
        backgroundColor, 
        borderRadius: 16,
        minHeight: 90,
      }}
    >
      <View className="flex-1 justify-between p-4">
        <View>
          <Text
            className="text-center text-[14px] font-bold leading-[18px] text-white"
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </View>

        <View className="mt-auto items-center pt-2">
          <View 
            className="rounded-lg px-3 py-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
          >
            <Text className="text-[13px] font-bold text-white">
              {formatIDR(item.price)}
              {isWeightBased && `/${item.unit_of_measure}`}
            </Text>
          </View>
        </View>

        {isLowStock && isAvailable && (
          <View 
            className="absolute left-2 top-2 rounded-lg px-2 py-1"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.9)' }}
          >
            <Text className="text-[10px] font-bold text-white">LOW STOCK</Text>
          </View>
        )}

        {!isAvailable && (
          <View 
            className="absolute left-2 top-2 rounded-lg px-2 py-1"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }}
          >
            <Text className="text-[10px] font-bold text-white">SOLD OUT</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
