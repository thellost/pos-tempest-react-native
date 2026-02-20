import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PRICING_TYPE } from '@/constants/enums';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';

const DEFAULT_BUTTON_COLOR = '#334155';

interface MenuItemCardProps {
  item: MenuItemWithInventory;
  categoryColor?: string | null;
  onPress: () => void;
}

export function MenuItemCard({ item, categoryColor, onPress }: MenuItemCardProps) {
  const isWeightBased = item.pricing_type === PRICING_TYPE.WEIGHT_BASED;
  const isAvailable = item.is_available;
  const isLowStock = item.isLowStock;
  const backgroundColor = isAvailable
    ? (categoryColor || DEFAULT_BUTTON_COLOR)
    : '#474747';

  const handlePress = useCallback(() => {
    if (isAvailable) {
      onPress();
    }
  }, [isAvailable, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isAvailable}
      className={`min-h-pos-touch items-center justify-center p-3 ${
        !isAvailable ? 'opacity-50' : ''
      } active:opacity-80`}
      style={{ backgroundColor, borderRadius: 4 }}
    >
      <View className="flex-1 items-center justify-center">
        <Text
          className="text-center text-pos-base font-bold text-white"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {item.name}
        </Text>

        <View className="mt-1 items-center">
          <Text className="text-pos-sm font-semibold text-white/90">
            {formatIDR(item.price)}
          </Text>
          {isWeightBased && (
            <Text className="text-pos-xs text-white/70">
              /{item.unit_of_measure}
            </Text>
          )}
        </View>

        {isLowStock && isAvailable && (
          <View className="mt-1 px-2 py-0.5" style={{ backgroundColor: 'rgba(217,119,6,0.8)', borderRadius: 2 }}>
            <Text className="text-pos-xs font-semibold text-white">
              Low Stock
            </Text>
          </View>
        )}

        {!isAvailable && (
          <View className="mt-1 px-2 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
            <Text className="text-pos-xs font-semibold text-white">
              Sold Out
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
