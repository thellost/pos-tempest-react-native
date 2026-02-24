import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PRICING_TYPE } from '@/constants/enums';
import { ModifierGroupRow } from '@/components/menu/ModifierGroupRow';
import { WeightInput } from '@/components/menu/WeightInput';
import type { ModifierGroupWithModifiers, MenuItemWithInventory } from '@/hooks/use-menu';
import type { SelectedModifier } from '@/services/order.service';
import { formatIDR } from '@/utils/currency';

interface ModifierPickerProps {
  visible: boolean;
  menuItem: MenuItemWithInventory;
  modifierGroups: ModifierGroupWithModifiers[];
  onConfirm: (modifiers: SelectedModifier[], weight: number | null, notes: string) => void;
  onCancel: () => void;
  initialSelectedModifiers?: SelectedModifier[];
  initialNotes?: string;
  initialWeight?: string;
  submitLabel?: string;
}

export function ModifierPicker({
  visible,
  menuItem,
  modifierGroups,
  onConfirm,
  onCancel,
  initialSelectedModifiers,
  initialNotes,
  initialWeight,
  submitLabel,
}: ModifierPickerProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<Map<number, SelectedModifier>>(new Map());
  const [weight, setWeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const isWeightBased = menuItem.pricing_type === PRICING_TYPE.WEIGHT_BASED;

  const sortedGroups = useMemo(() => {
    return [...modifierGroups].sort((left, right) => {
      if (left.is_required === right.is_required) return 0;
      return left.is_required ? -1 : 1;
    });
  }, [modifierGroups]);

  const selectedMapFromInitial = useMemo(() => {
    if (!initialSelectedModifiers) return new Map<number, SelectedModifier>();
    return new Map(initialSelectedModifiers.map((modifier: SelectedModifier) => [modifier.modifier_id, modifier]));
  }, [initialSelectedModifiers]);

  const normalizedInitialWeight = useMemo(() => {
    if (!initialWeight) return '';
    return initialWeight;
  }, [initialWeight]);

  const normalizedInitialNotes = useMemo(() => initialNotes ?? '', [initialNotes]);

  useEffect(() => {
    if (!visible) return;
    setSelectedModifiers(selectedMapFromInitial);
    setWeight(normalizedInitialWeight);
    setNotes(normalizedInitialNotes);
  }, [visible, normalizedInitialNotes, normalizedInitialWeight, selectedMapFromInitial]);

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

  const isSelectionValid = useMemo(() => {
    return sortedGroups.every((group) => {
      if (!group.is_required) return true;
      const groupModifiers = Array.from(selectedModifiers.values()).filter(
        m => m.modifier_group_name === group.name
      );
      return groupModifiers.length >= group.min_selections;
    });
  }, [selectedModifiers, sortedGroups]);

  const handleConfirm = () => {
    for (const group of sortedGroups) {
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

  const canSubmit = isSelectionValid && (!isWeightBased || (weight && parseFloat(weight) > 0));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-surface">
        <View className="border-b border-border bg-surface-card px-6 py-4">
          <View className="flex-row items-center justify-between">
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
              className="h-10 w-10 items-center justify-center rounded-full bg-surface-raised"
            >
              <Text className="text-pos-lg text-pos-text-muted">✕</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView className="flex-1 px-6 py-4" showsVerticalScrollIndicator={false}>
          {isWeightBased && (
            <View className="mb-6">
              <Text className="mb-3 text-pos-base font-semibold text-pos-text">
                Weight ({menuItem.unit_of_measure})
              </Text>
              <WeightInput
                value={weight}
                unitLabel={menuItem.unit_of_measure}
                onChange={setWeight}
              />
            </View>
          )}

          {sortedGroups.map((group) => {
            const groupId = typeof group.id === 'string' ? parseInt(group.id, 10) : group.id;
            const selectedIds = new Set(
              Array.from(selectedModifiers.entries())
                .filter(([, mod]) => mod.modifier_group_name === group.name)
                .map(([id]) => id)
            );

            return (
              <ModifierGroupRow
                key={group.id}
                group={group}
                selectedModifierIds={selectedIds}
                onToggle={(modifierId) => toggleModifier(groupId, group, modifierId)}
              />
            );
          })}

          <View className="mb-6">
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

        <View className="border-t border-border bg-surface-card px-6 py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-pos-xs text-pos-text-muted">Total</Text>
              <Text className="text-pos-2xl font-bold text-amber-400">
                {formatIDR(calculateTotal())}
              </Text>
            </View>
            <Pressable
              onPress={handleConfirm}
              disabled={!canSubmit}
              className={`rounded-xl px-8 py-4 ${
                canSubmit ? 'bg-amber-500' : 'bg-surface-raised'
              }`}
            >
              <Text className={`text-pos-base font-semibold ${canSubmit ? 'text-white' : 'text-pos-text-muted'}`}>
                {submitLabel ?? 'Add to Order'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
