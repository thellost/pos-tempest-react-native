import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { FloorArea } from '@/db/models';
import { ThemeColors } from '@/constants/theme';
import { toInt } from '@/utils/coerce';

interface FloorAreaTabsProps {
  floorAreas: FloorArea[];
  selectedAreaId: number | null;
  onSelectArea: (areaId: number | null, isTakeaway?: boolean) => void;
  showTakeawayTab?: boolean;
  isTakeawaySelected?: boolean;
  activeTakeawayCount?: number;
}

const TAKEAWAY_TAB_ID = 'takeaway';

export function FloorAreaTabs({ 
  floorAreas, 
  selectedAreaId, 
  onSelectArea,
  showTakeawayTab = true,
  isTakeawaySelected = false,
  activeTakeawayCount = 0,
}: FloorAreaTabsProps) {
  if (floorAreas.length === 0 && !showTakeawayTab) {
    return null;
  }

  return (
    <View className="border-b border-border bg-surface-card px-4 py-2">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {floorAreas.map((area) => {
          const areaId = toInt(area.id);
          const isSelected = areaId === selectedAreaId && !isTakeawaySelected;
          
          return (
            <Pressable
              key={area.id}
              onPress={() => onSelectArea(areaId, false)}
              className="mr-2 rounded-sm px-3 py-2"
              style={{
                backgroundColor: isSelected ? ThemeColors.accent.primary : 'transparent',
                borderWidth: isSelected ? 0 : 1,
                borderColor: ThemeColors.borders.medium,
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
        
        {showTakeawayTab && (
          <Pressable
            onPress={() => onSelectArea(null, true)}
            className="mr-2 flex-row items-center rounded-sm px-3 py-2"
            style={{
              backgroundColor: isTakeawaySelected ? ThemeColors.warning.DEFAULT : 'transparent',
              borderWidth: isTakeawaySelected ? 0 : 1,
              borderColor: ThemeColors.borders.medium,
            }}
          >
            <Text className="mr-2 text-base">🛍</Text>
            <Text
              className={`text-pos-base font-semibold ${
                isTakeawaySelected
                  ? 'text-white'
                  : 'text-pos-text-muted'
              }`}
            >
              Takeaway
            </Text>
            {activeTakeawayCount > 0 && (
              <View 
                className="ml-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: isTakeawaySelected ? 'rgba(255,255,255,0.3)' : ThemeColors.warning.DEFAULT }}
              >
                <Text className="text-xs font-bold text-white">
                  {activeTakeawayCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
