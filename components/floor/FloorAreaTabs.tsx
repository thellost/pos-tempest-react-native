import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { FloorArea } from '@/db/models';

interface FloorAreaTabsProps {
  floorAreas: FloorArea[];
  selectedAreaId: number | null;
  onSelectArea: (areaId: number) => void;
}

/**
 * Horizontal tabs for floor areas (Indoor, Outdoor, VIP, etc.)
 * Provides navigation between different floor sections.
 */
export function FloorAreaTabs({ floorAreas, selectedAreaId, onSelectArea }: FloorAreaTabsProps) {
  if (floorAreas.length === 0) {
    return null;
  }

  return (
    <View className="mb-4 border-b border-white/10">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {floorAreas.map((area) => {
          // Ensure both IDs are numbers for comparison
          const areaId = typeof area.id === 'string' ? parseInt(area.id, 10) : area.id;
          const isSelected = areaId === selectedAreaId;
          
          return (
            <Pressable
              key={area.id}
              onPress={() => onSelectArea(areaId)}
              className={`mr-2 px-6 py-3 ${
                isSelected 
                  ? 'border-b-2 border-primary' 
                  : ''
              }`}
            >
              <Text 
                className={`text-pos-lg font-semibold ${
                  isSelected 
                    ? 'text-primary' 
                    : 'text-pos-muted'
                }`}
              >
                {area.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
