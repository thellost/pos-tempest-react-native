import { Text, View } from 'react-native';

import type { ModifierGroupWithModifiers } from '@/hooks/use-menu';
import { formatIDR } from '@/utils/currency';
import { toInt } from '@/utils/coerce';
import { SelectButton } from '@/components/ui';

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
          const modifierId = toInt(modifier.id);
          const isSelected = selectedModifierIds.has(modifierId);

          return (
            <SelectButton
              key={modifier.id}
              onPress={() => onToggle(modifierId)}
              selected={isSelected}
              selectedClassName="border-amber-500 bg-amber-500/20"
              unselectedClassName="border-border bg-surface-card"
              className="px-5 py-4"
            >
              <View className="flex-row items-start">
                <View
                  className={`mr-3 mt-0.5 h-5 w-5 items-center justify-center rounded-full ${
                    isSelected ? 'bg-amber-500' : 'bg-surface-raised'
                  }`}
                >
                  {isSelected && <Text className="text-[11px] text-white">✓</Text>}
                </View>
                <View>
                  <Text className="text-pos-base text-pos-text">
                    {modifier.name}
                  </Text>
                  {modifier.extra_price > 0 && (
                    <Text className="mt-0.5 text-pos-sm font-semibold text-pos-price">
                      +{formatIDR(modifier.extra_price)}
                    </Text>
                  )}
                </View>
              </View>
            </SelectButton>
          );
        })}
      </View>
    </View>
  );
}
