import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { Category } from '@/db/models';

interface CategoryTabsProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number) => void;
}

/**
 * Horizontal tabs for top-level categories.
 * Provides navigation between different menu categories (e.g., Food, Drinks, Desserts).
 */
export function CategoryTabs({ categories, selectedCategoryId, onSelectCategory }: CategoryTabsProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <View className="mb-2 border-b border-white/10">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {categories.map((category) => {
          const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
          const isSelected = categoryId === selectedCategoryId;
          
          // Category colors (Toast POS style)
          const getCategoryColor = () => {
            const colors = [
              'bg-yellow-700',
              'bg-green-700',
              'bg-blue-700',
              'bg-purple-700',
              'bg-orange-700',
              'bg-red-700',
            ];
            const hash = category.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return colors[hash % colors.length];
          };

          return (
            <Pressable
              key={`category-${category.id}`}
              onPress={() => onSelectCategory(categoryId)}
              className={`mr-2 rounded-lg px-6 py-3 ${
                isSelected 
                  ? getCategoryColor()
                  : 'bg-surface-soft'
              }`}
            >
              <Text 
                className={`text-pos-base font-semibold ${
                  isSelected 
                    ? 'text-white' 
                    : 'text-pos-muted'
                }`}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
