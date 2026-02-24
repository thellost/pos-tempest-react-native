import { Pressable, Text, View } from 'react-native';

import type { ModifierGroupWithModifiers } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';

interface ModifierGroupRowProps {
  group: ModifierGroupWithModifiers;
  selectedModifierIds: Set<number>;
  onToggle: (modifierId: number) => void;
}

export function ModifierGroupRow({ group, selectedModifierIds, onToggle }: ModifierGroupRowProps) {
  const selectedCount = selectedModifierIds.size;
  const maxSelections = group.max_selections;

  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-pos-base font-semibold text-pos-text">
          {group.name}
          {group.is_required && <Text className="text-pos-danger"> *</Text>}
        </Text>
        <Text className="text-pos-xs text-pos-text-faint">
          {group.min_selections === group.max_selections
            ? `Select ${group.min_selections}`
            : `${group.min_selections}-${group.max_selections}`}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {group.modifiers.map((modifier) => {
          const modifierId = typeof modifier.id === 'string' ? parseInt(modifier.id, 10) : modifier.id;
          const isSelected = selectedModifierIds.has(modifierId);

          return (
            <Pressable
              key={modifier.id}
              onPress={() => onToggle(modifierId)}
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.2)' : '#1A1F2C',
                borderWidth: 1,
                borderColor: isSelected ? '#F59E0B' : 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View
                    className={`mr-2 h-4 w-4 items-center justify-center rounded-full ${
                      isSelected ? 'bg-amber-500' : 'bg-surface-raised'
                    }`}
                  >
                    {isSelected && <Text className="text-[10px] text-white">✓</Text>}
                  </View>
                  <Text className="text-pos-sm text-pos-text">
                    {modifier.name}
                  </Text>
                </View>
                {modifier.extra_price > 0 && (
                  <Text className="text-pos-xs font-semibold text-amber-400">
                    +{formatIDR(modifier.extra_price)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
