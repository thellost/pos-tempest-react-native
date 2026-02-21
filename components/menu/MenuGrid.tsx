import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Category } from '@/db/models';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import { MenuItemCard } from './MenuItemCard';

const { width } = Dimensions.get('window');
const GRID_PADDING = 16;
const GAP = 12;
const COLUMNS = 4;
const ASPECT_RATIO = 1.15;

interface MenuGridProps {
  items: MenuItemWithInventory[];
  category?: Category;
  onItemPress: (item: MenuItemWithInventory) => void;
  onRefresh?: () => Promise<void>;
}

export function MenuGrid({ items, category, onItemPress, onRefresh }: MenuGridProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const handleItemPress = useCallback((item: MenuItemWithInventory) => {
    onItemPress(item);
  }, [onItemPress]);

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <Text className="text-3xl">📋</Text>
        </View>
        <Text className="text-pos-lg text-pos-text-muted">
          No items available
        </Text>
        <Text className="mt-2 text-pos-sm text-pos-text-faint">
          {category ? `in ${category.name}` : 'in this category'}
        </Text>
      </View>
    );
  }

  const gridWidth = width * 0.70 - GRID_PADDING * 2;
  const itemWidth = (gridWidth - GAP * (COLUMNS - 1)) / COLUMNS;
  const itemHeight = itemWidth * ASPECT_RATIO;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ padding: GRID_PADDING }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        ) : undefined
      }
    >
      <View 
        className="flex-row flex-wrap" 
        style={{ gap: GAP }}
      >
        {items.map((item) => (
          <View
            key={`menu-item-${item.id}`}
            style={{
              width: itemWidth,
              height: itemHeight,
            }}
          >
            <MenuItemCard
              item={item}
              categoryColor={category?.button_color}
              onPress={() => handleItemPress(item)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
