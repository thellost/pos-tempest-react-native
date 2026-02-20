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
    <View className="bg-surface-soft">
      {/* Main Category Tabs - Connected Tab Group Style */}
      <View className="flex-row border-b border-white/10">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4 }}
          className="flex-grow-0"
        >
          {categories.map((category, index) => {
            const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
            const isSelected = categoryId === selectedCategoryId;
            const backgroundColor = category.button_color || DEFAULT_BUTTON_COLOR;
            const isFirst = index === 0;
            const isLast = index === categories.length - 1;

            return (
              <Pressable
                key={`category-${category.id}`}
                onPress={() => handleCategoryPress(categoryId)}
                className={`min-h-pos-touch justify-center px-5 ${
                  isFirst ? 'rounded-tl' : ''
                } ${isLast ? 'rounded-tr' : ''}`}
                style={{
                  backgroundColor: isSelected ? backgroundColor : 'transparent',
                  borderRightWidth: isLast ? 0 : 1,
                  borderRightColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text
                  className={`text-pos-base font-semibold ${
                    isSelected ? 'text-white' : 'text-pos-muted'
                  }`}
                >
                  {category.name}
                </Text>
                {isSelected && (
                  <View
                    className="absolute bottom-0 left-0 right-0 h-1 rounded-t"
                    style={{ backgroundColor: '#803500' }}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Sub-Category Pills - Connected Style */}
      {subCategories.length > 0 && (
        <View className="flex-row border-b border-white/10 bg-surface px-2 py-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0"
          >
            <Pressable
              onPress={() => onSelectSubCategory(null)}
              className={`items-center justify-center px-4 py-2 ${
                selectedSubCategoryId === null
                  ? 'bg-toast-orange-3'
                  : 'bg-transparent'
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

            <View className="mx-1 h-auto w-px bg-white/10" />

            {subCategories.map((subCategory, index) => {
              const subCategoryId = typeof subCategory.id === 'string' ? parseInt(subCategory.id, 10) : subCategory.id;
              const isSelected = subCategoryId === selectedSubCategoryId;

              return (
                <View key={`sub-category-${subCategory.id}`} className="flex-row items-center">
                  <Pressable
                    onPress={() => handleSubCategoryPress(subCategoryId)}
                    className={`items-center justify-center px-4 py-2 ${
                      isSelected ? 'bg-toast-orange-3' : 'bg-transparent'
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
                  {index < subCategories.length - 1 && (
                    <View className="mx-1 h-auto w-px bg-white/10" />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
