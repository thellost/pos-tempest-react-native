import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { FloorArea } from '@/db/models';

interface FloorAreaTabsProps {
  floorAreas: FloorArea[];
  selectedAreaId: number | null;
  onSelectArea: (areaId: number) => void;
}

export function FloorAreaTabs({ floorAreas, selectedAreaId, onSelectArea }: FloorAreaTabsProps) {
  if (floorAreas.length === 0) {
    return null;
  }

  return (
    <View className="border-b border-border bg-surface-card px-4 py-3">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {floorAreas.map((area) => {
          const areaId = typeof area.id === 'string' ? parseInt(area.id, 10) : area.id;
          const isSelected = areaId === selectedAreaId;
          
          return (
            <Pressable
              key={area.id}
              onPress={() => onSelectArea(areaId)}
              className="mr-2 rounded-xl px-5 py-3"
              style={{
                backgroundColor: isSelected ? '#6366F1' : 'transparent',
                borderWidth: isSelected ? 0 : 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text 
                className={`text-pos-base font-semibold ${
                  isSelected 
                    ? 'text-white' 
                    : 'text-pos-text-muted'
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
