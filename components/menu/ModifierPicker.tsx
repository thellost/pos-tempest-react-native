import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';

import { PRICING_TYPE } from '@/constants/enums';
import type { ModifierGroupWithModifiers, MenuItemWithInventory } from '@/hooks/use-menu';
import type { SelectedModifier } from '@/services/order.service';
import { formatIDR } from '@/utils/currency';

interface ModifierPickerProps {
  visible: boolean;
  menuItem: MenuItemWithInventory;
  modifierGroups: ModifierGroupWithModifiers[];
  onConfirm: (modifiers: SelectedModifier[], weight: number | null, notes: string) => void;
  onCancel: () => void;
}

/**
 * Bottom sheet/modal for selecting modifiers for a menu item.
 * Respects is_required, min_selections, max_selections.
 * For weight-based items, includes a numeric input for weight.
 */
export function ModifierPicker({
  visible,
  menuItem,
  modifierGroups,
  onConfirm,
  onCancel,
}: ModifierPickerProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<Map<number, SelectedModifier>>(new Map());
  const [weight, setWeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const isWeightBased = menuItem.pricing_type === PRICING_TYPE.WEIGHT_BASED;

  // Toggle modifier selection
  const toggleModifier = (groupId: number, group: ModifierGroupWithModifiers, modifierId: number) => {
    const newSelected = new Map(selectedModifiers);
    const groupModifiers = Array.from(newSelected.values()).filter(
      m => m.modifier_group_name === group.name
    );

    if (newSelected.has(modifierId)) {
      // Deselect
      newSelected.delete(modifierId);
    } else {
      // Check max_selections
      if (groupModifiers.length >= group.max_selections) {
        // Remove the first selected modifier in this group
        const firstModifier = groupModifiers[0];
        if (firstModifier) {
          const firstModifierId = Array.from(newSelected.entries()).find(
            ([, mod]) => mod === firstModifier
          )?.[0];
          if (firstModifierId) {
            newSelected.delete(firstModifierId);
          }
        }
      }

      // Add the new modifier
      const modifier = group.modifiers.find(m => {
        const mId = typeof m.id === 'string' ? parseInt(m.id, 10) : m.id;
        return mId === modifierId;
      });

      if (modifier) {
        newSelected.set(modifierId, {
          modifier_id: modifierId,
          modifier_name: modifier.name,
          modifier_group_name: group.name,
          extra_price: modifier.extra_price,
        });
      }
    }

    setSelectedModifiers(newSelected);
  };

  // Validate and confirm
  const handleConfirm = () => {
    // Validate required groups
    for (const group of modifierGroups) {
      const groupModifiers = Array.from(selectedModifiers.values()).filter(
        m => m.modifier_group_name === group.name
      );

      if (group.is_required && groupModifiers.length < group.min_selections) {
        alert(`Please select at least ${group.min_selections} option(s) for ${group.name}`);
        return;
      }
    }

    // Validate weight for weight-based items
    if (isWeightBased && (!weight || parseFloat(weight) <= 0)) {
      alert('Please enter a valid weight');
      return;
    }

    const weightValue = isWeightBased ? parseFloat(weight) : null;
    onConfirm(Array.from(selectedModifiers.values()), weightValue, notes);

    // Reset state
    setSelectedModifiers(new Map());
    setWeight('');
    setNotes('');
  };

  // Calculate total price
  const calculateTotal = (): number => {
    let basePrice = menuItem.price;

    if (isWeightBased && weight) {
      basePrice = menuItem.price * parseFloat(weight);
    }

    const modifierTotal = Array.from(selectedModifiers.values()).reduce(
      (sum, mod) => sum + mod.extra_price,
      0
    );

    return basePrice + modifierTotal;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[80%] rounded-t-3xl bg-surface p-6">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-pos-2xl font-bold text-pos-text-strong">
              {menuItem.name}
            </Text>
            <Pressable onPress={onCancel}>
              <Text className="text-pos-xl text-pos-muted">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="mb-4 flex-1">
            {/* Weight input for weight-based items */}
            {isWeightBased && (
              <View className="mb-4">
                <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">
                  Weight ({menuItem.unit_of_measure})
                </Text>
                <TextInput
                  className="rounded-lg border border-white/20 bg-surface-soft px-4 py-3 text-pos-base text-pos-text-strong"
                  placeholder={`Enter weight in ${menuItem.unit_of_measure}`}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                />
                <Text className="mt-1 text-pos-sm text-pos-muted">
                  {formatIDR(menuItem.price)} per {menuItem.unit_of_measure}
                </Text>
              </View>
            )}

            {/* Modifier groups */}
            {modifierGroups.map((group) => {
              const groupId = typeof group.id === 'string' ? parseInt(group.id, 10) : group.id;

              return (
                <View key={group.id} className="mb-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-pos-base font-semibold text-pos-text-strong">
                      {group.name}
                      {group.is_required && <Text className="text-red-500"> *</Text>}
                    </Text>
                    <Text className="text-pos-xs text-pos-muted">
                      {group.min_selections === group.max_selections
                        ? `Select ${group.min_selections}`
                        : `Select ${group.min_selections}-${group.max_selections}`}
                    </Text>
                  </View>

                  {group.modifiers.map((modifier) => {
                    const modifierId = typeof modifier.id === 'string' ? parseInt(modifier.id, 10) : modifier.id;
                    const isSelected = selectedModifiers.has(modifierId);

                    return (
                      <Pressable
                        key={modifier.id}
                        onPress={() => toggleModifier(groupId, group, modifierId)}
                        className={`mb-2 flex-row items-center justify-between rounded-lg border p-3 ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-white/10 bg-surface-soft'
                        }`}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-white/30'
                            }`}
                          >
                            {isSelected && (
                              <Text className="text-pos-xs text-white">✓</Text>
                            )}
                          </View>
                          <Text className="text-pos-base text-pos-text-strong">
                            {modifier.name}
                          </Text>
                        </View>
                        {modifier.extra_price > 0 && (
                          <Text className="text-pos-sm text-primary">
                            +{formatIDR(modifier.extra_price)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            {/* Notes */}
            <View className="mb-4">
              <Text className="mb-2 text-pos-base font-semibold text-pos-text-strong">
                Special Instructions (Optional)
              </Text>
              <TextInput
                className="rounded-lg border border-white/20 bg-surface-soft px-4 py-3 text-pos-base text-pos-text-strong"
                placeholder="e.g., Extra spicy, No ice"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="flex-row items-center justify-between border-t border-white/10 pt-4">
            <View>
              <Text className="text-pos-xs text-pos-muted">Total</Text>
              <Text className="text-pos-2xl font-bold text-primary">
                {formatIDR(calculateTotal())}
              </Text>
            </View>
            <Pressable
              onPress={handleConfirm}
              className="rounded-lg bg-primary px-8 py-3"
            >
              <Text className="text-pos-base font-semibold text-white">
                Add to Order
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
