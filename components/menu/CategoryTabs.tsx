import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { Category } from '@/db/models';

interface CategoryTabsProps {
  categories: Category[];
  subCategories: Category[];
  selectedCategoryId: number | null;
  selectedSubCategoryId: number | null;
  onSelectCategory: (categoryId: number) => void;
  onSelectSubCategory: (subCategoryId: number | null) => void;
}

const DEFAULT_BUTTON_COLOR = '#334155';

export function CategoryTabs({
  categories,
  subCategories,
  selectedCategoryId,
  selectedSubCategoryId,
  onSelectCategory,
  onSelectSubCategory,
}: CategoryTabsProps) {
  const handleCategoryPress = useCallback((categoryId: number) => {
    onSelectCategory(categoryId);
    onSelectSubCategory(null);
  }, [onSelectCategory, onSelectSubCategory]);

  const handleSubCategoryPress = useCallback((subCategoryId: number) => {
    onSelectSubCategory(subCategoryId);
  }, [onSelectSubCategory]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <View className="border-b border-white/10 bg-surface-soft">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
        className="flex-grow-0"
      >
        {categories.map((category) => {
          const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
          const isSelected = categoryId === selectedCategoryId;
          const backgroundColor = category.button_color || DEFAULT_BUTTON_COLOR;

          return (
            <Pressable
              key={`category-${category.id}`}
              onPress={() => handleCategoryPress(categoryId)}
              className={`mr-2 min-h-pos-touch justify-center rounded-lg px-6 ${
                isSelected ? 'border-b-4 border-toast-orange-3' : ''
              }`}
              style={{ backgroundColor: isSelected ? backgroundColor : 'transparent' }}
            >
              <Text
                className={`text-pos-base font-semibold ${
                  isSelected ? 'text-white' : 'text-pos-muted'
                }`}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {subCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
          className="flex-grow-0"
        >
          <Pressable
            onPress={() => onSelectSubCategory(null)}
            className={`mr-2 items-center justify-center rounded-full px-4 py-2 ${
              selectedSubCategoryId === null
                ? 'bg-toast-orange-3'
                : 'bg-surface-card'
            }`}
          >
            <Text
              className={`text-pos-sm font-medium ${
                selectedSubCategoryId === null ? 'text-white' : 'text-pos-muted'
              }`}
            >
              All
            </Text>
          </Pressable>

          {subCategories.map((subCategory) => {
            const subCategoryId = typeof subCategory.id === 'string' ? parseInt(subCategory.id, 10) : subCategory.id;
            const isSelected = subCategoryId === selectedSubCategoryId;

            return (
              <Pressable
                key={`sub-category-${subCategory.id}`}
                onPress={() => handleSubCategoryPress(subCategoryId)}
                className={`mr-2 items-center justify-center rounded-full px-4 py-2 ${
                  isSelected ? 'bg-toast-orange-3' : 'bg-surface-card'
                }`}
              >
                <Text
                  className={`text-pos-sm font-medium ${
                    isSelected ? 'text-white' : 'text-pos-muted'
                  }`}
                >
                  {subCategory.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
