import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { PRICING_TYPE } from '@/constants/enums';
import type { MenuItem } from '@/db/models';
import { formatIDR } from '@/utils/currency';

interface MenuItemCardProps {
  item: MenuItem;
  onPress: () => void;
}

/**
 * Card component for a single menu item.
 * Shows name, price, unit, availability.
 * Color/icon for weight-based items.
 */
export function MenuItemCard({ item, onPress }: MenuItemCardProps) {
  const isWeightBased = item.pricing_type === PRICING_TYPE.WEIGHT_BASED;
  const isAvailable = item.is_available;

  // Category-based colors (Toast POS style)
  const getBackgroundColor = () => {
    if (!isAvailable) return 'bg-gray-600';
    
    // You can customize colors based on category
    const categoryColors = [
      'bg-orange-600',
      'bg-green-700',
      'bg-blue-700',
      'bg-purple-700',
      'bg-yellow-700',
      'bg-red-700',
      'bg-teal-700',
      'bg-indigo-700',
    ];
    
    // Simple hash to pick consistent color
    const hash = item.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return categoryColors[hash % categoryColors.length];
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!isAvailable}
      className={`min-h-[100px] items-center justify-center rounded-lg p-4 ${
        getBackgroundColor()
      } ${
        !isAvailable ? 'opacity-50' : 'active:scale-98'
      }`}
    >
      {/* Item name */}
      <Text 
        className="text-center text-pos-lg font-bold text-white"
        numberOfLines={2}
      >
        {item.name}
      </Text>

      {/* Price */}
      <View className="mt-2">
        <Text className="text-center text-pos-base font-semibold text-white/90">
          {formatIDR(item.price)}
        </Text>
        {isWeightBased && (
          <Text className="text-center text-pos-xs text-white/90">
            per {item.unit_of_measure}
          </Text>
        )}
      </View>

      {/* Not available badge */}
      {!isAvailable && (
        <View className="mt-2 rounded-full bg-black/30 px-3 py-1">
          <Text className="text-pos-xs font-semibold text-white">Sold Out</Text>
        </View>
      )}
    </Pressable>
  );
}
