import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { MenuItem } from '@/db/models';
import { MenuItemCard } from './MenuItemCard';

interface MenuGridProps {
  items: MenuItem[];
  onItemPress: (item: MenuItem) => void;
}

/**
 * Responsive grid of menu item cards.
 */
export function MenuGrid({ items, onItemPress }: MenuGridProps) {
  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-pos-base text-pos-muted">
          No items available in this category
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1"
      contentContainerStyle={{ padding: 16 }}
    >
      <View className="flex-row flex-wrap gap-4">
        {items.map((item) => (
          <View key={`menu-item-${item.id}`} className="w-[31%]">
            <MenuItemCard 
              item={item} 
              onPress={() => onItemPress(item)} 
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
