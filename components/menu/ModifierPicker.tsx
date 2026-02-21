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

  const toggleModifier = (groupId: number, group: ModifierGroupWithModifiers, modifierId: number) => {
    const newSelected = new Map(selectedModifiers);
    const groupModifiers = Array.from(newSelected.values()).filter(
      m => m.modifier_group_name === group.name
    );

    if (newSelected.has(modifierId)) {
      newSelected.delete(modifierId);
    } else {
      if (groupModifiers.length >= group.max_selections) {
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

  const handleConfirm = () => {
    for (const group of modifierGroups) {
      const groupModifiers = Array.from(selectedModifiers.values()).filter(
        m => m.modifier_group_name === group.name
      );

      if (group.is_required && groupModifiers.length < group.min_selections) {
        alert(`Please select at least ${group.min_selections} option(s) for ${group.name}`);
        return;
      }
    }

    if (isWeightBased && (!weight || parseFloat(weight) <= 0)) {
      alert('Please enter a valid weight');
      return;
    }

    const weightValue = isWeightBased ? parseFloat(weight) : null;
    onConfirm(Array.from(selectedModifiers.values()), weightValue, notes);

    setSelectedModifiers(new Map());
    setWeight('');
    setNotes('');
  };

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
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[85%] rounded-t-3xl bg-surface-soft p-6">
          <View className="mb-5 flex-row items-center justify-between">
            <View>
              <Text className="text-pos-2xl font-bold text-pos-text">
                {menuItem.name}
              </Text>
              <Text className="mt-1 text-pos-sm text-pos-text-muted">
                {formatIDR(menuItem.price)}
                {isWeightBased && ` per ${menuItem.unit_of_measure}`}
              </Text>
            </View>
            <Pressable 
              onPress={onCancel}
              className="h-10 w-10 items-center justify-center rounded-full bg-surface-card"
            >
              <Text className="text-pos-lg text-pos-text-muted">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="mb-4 flex-1" showsVerticalScrollIndicator={false}>
            {isWeightBased && (
              <View className="mb-5">
                <Text className="mb-2 text-pos-base font-semibold text-pos-text">
                  Weight ({menuItem.unit_of_measure})
                </Text>
                <TextInput
                  className="rounded-xl border border-border bg-surface-card px-4 py-3.5 text-pos-base text-pos-text"
                  placeholder={`Enter weight in ${menuItem.unit_of_measure}`}
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
            )}

            {modifierGroups.map((group) => {
              const groupId = typeof group.id === 'string' ? parseInt(group.id, 10) : group.id;

              return (
                <View key={group.id} className="mb-5">
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

                  {group.modifiers.map((modifier) => {
                    const modifierId = typeof modifier.id === 'string' ? parseInt(modifier.id, 10) : modifier.id;
                    const isSelected = selectedModifiers.has(modifierId);

                    return (
                      <Pressable
                        key={modifier.id}
                        onPress={() => toggleModifier(groupId, group, modifierId)}
                        className="mb-2 flex-row items-center justify-between rounded-xl p-4"
                        style={{
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : '#1A1F2C',
                          borderWidth: 1,
                          borderColor: isSelected ? '#6366F1' : 'rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`mr-3 h-5 w-5 items-center justify-center rounded-full ${
                              isSelected ? 'bg-accent' : 'bg-surface-raised'
                            }`}
                          >
                            {isSelected && (
                              <Text className="text-pos-xs text-white">✓</Text>
                            )}
                          </View>
                          <Text className="text-pos-base text-pos-text">
                            {modifier.name}
                          </Text>
                        </View>
                        {modifier.extra_price > 0 && (
                          <Text className="text-pos-sm font-semibold text-accent">
                            +{formatIDR(modifier.extra_price)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            <View className="mb-4">
              <Text className="mb-2 text-pos-base font-semibold text-pos-text">
                Special Instructions
              </Text>
              <TextInput
                className="rounded-xl border border-border bg-surface-card px-4 py-3.5 text-pos-base text-pos-text"
                placeholder="e.g., Extra spicy, No ice"
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          <View className="flex-row items-center justify-between border-t border-border pt-5">
            <View>
              <Text className="text-pos-xs text-pos-text-muted">Total</Text>
              <Text className="text-pos-2xl font-bold text-accent">
                {formatIDR(calculateTotal())}
              </Text>
            </View>
            <Pressable
              onPress={handleConfirm}
              className="rounded-xl bg-accent px-8 py-4"
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
