import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

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

  const renderedCategoryTabs = useMemo(() => {
    return categories.map((category) => {
      const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
      const isSelected = categoryId === selectedCategoryId;
      const baseColor = category.button_color || DEFAULT_BUTTON_COLOR;

      return (
        <Pressable
          key={`category-${category.id}`}
          onPress={() => handleCategoryPress(categoryId)}
          className="flex-1 items-center justify-center py-3"
          style={({ pressed }) => ({
            backgroundColor: baseColor,
            borderRadius: 6,
            opacity: pressed ? 0.7 : (isSelected ? 1 : 0.5),
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text
            className="text-pos-sm font-bold text-white"
            numberOfLines={1}
          >
            {category.name}
          </Text>
        </Pressable>
      );
    });
  }, [categories, selectedCategoryId, handleCategoryPress]);

  const renderedSubCategoryTabs = useMemo(() => {
    return subCategories.map((subCategory) => {
      const subCategoryId = typeof subCategory.id === 'string' ? parseInt(subCategory.id, 10) : subCategory.id;
      const isSelected = subCategoryId === selectedSubCategoryId;

      return (
        <Pressable
          key={`sub-category-${subCategory.id}`}
          onPress={() => handleSubCategoryPress(subCategoryId)}
          className="items-center justify-center px-3 py-2"
          style={({ pressed }) => ({
            backgroundColor: isSelected ? '#6366F1' : '#2A3142',
            borderRadius: 6,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            className={`text-pos-xs font-semibold ${
              isSelected ? 'text-white' : 'text-pos-text-muted'
            }`}
            numberOfLines={1}
          >
            {subCategory.name}
          </Text>
        </Pressable>
      );
    });
  }, [subCategories, selectedSubCategoryId, handleSubCategoryPress]);

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
      <View 
        className="flex-row gap-2 px-4 py-3"
        style={{ marginLeft: 8 }}
      >
        {renderedCategoryTabs}
      </View>

      {subCategories.length > 0 && (
        <View className="flex-row gap-2 border-t border-border px-4 py-2">
          <Pressable
            onPress={() => onSelectSubCategory(null)}
            className="items-center justify-center px-3 py-2"
            style={({ pressed }) => ({
              backgroundColor: selectedSubCategoryId === null ? '#6366F1' : '#2A3142',
              borderRadius: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              className={`text-pos-xs font-semibold ${
                selectedSubCategoryId === null ? 'text-white' : 'text-pos-text-muted'
              }`}
            >
              All
            </Text>
          </Pressable>

          {renderedSubCategoryTabs}
        </View>
      )}
    </View>
  );
}
