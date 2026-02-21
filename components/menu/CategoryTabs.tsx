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

const DEFAULT_BUTTON_COLOR = '#475569';

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
    return (
      <View className="border-b border-border bg-surface-soft px-5 py-4">
        <Text className="text-pos-sm text-pos-text-muted">
          Loading categories...
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface-soft">
      <View className="border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
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
                className="mr-2 min-h-pos-touch justify-center px-5"
                style={{
                  backgroundColor: isSelected ? backgroundColor : 'transparent',
                  borderRadius: 12,
                  borderWidth: isSelected ? 0 : 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text
                  className={`text-pos-base font-semibold ${
                    isSelected ? 'text-white' : 'text-pos-text-muted'
                  }`}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {subCategories.length > 0 && (
        <View className="border-b border-border bg-surface px-3 py-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0"
          >
            <Pressable
              onPress={() => onSelectSubCategory(null)}
              className="mr-2 items-center justify-center rounded-lg px-4 py-2"
              style={{
                backgroundColor: selectedSubCategoryId === null ? '#6366F1' : 'transparent',
                borderWidth: selectedSubCategoryId === null ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text
                className={`text-pos-sm font-medium ${
                  selectedSubCategoryId === null ? 'text-white' : 'text-pos-text-muted'
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
                  className="mr-2 items-center justify-center rounded-lg px-4 py-2"
                  style={{
                    backgroundColor: isSelected ? '#6366F1' : 'transparent',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text
                    className={`text-pos-sm font-medium ${
                      isSelected ? 'text-white' : 'text-pos-text-muted'
                    }`}
                  >
                    {subCategory.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
