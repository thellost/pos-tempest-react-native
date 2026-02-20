import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Category } from '@/db/models';
import type { MenuItemWithInventory } from '@/hooks/use-menu';
import { MenuItemCard } from './MenuItemCard';

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 16;
const COLUMN_COUNT = 4;
const ITEM_MARGIN = GRID_GAP / 2;

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
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-pos-lg text-pos-muted">
          No items available
        </Text>
        <Text className="mt-2 text-pos-sm text-pos-muted">
          {category ? `in ${category.name}` : 'in this category'}
        </Text>
      </View>
    );
  }

  const itemWidth = (width * 0.65 - GRID_PADDING * 2 - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: GRID_PADDING }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#803500"
            colors={['#803500']}
          />
        ) : undefined
      }
    >
      <View className="flex-row flex-wrap" style={{ margin: -ITEM_MARGIN }}>
        {items.map((item) => (
          <View
            key={`menu-item-${item.id}`}
            style={{
              width: itemWidth,
              padding: ITEM_MARGIN,
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
