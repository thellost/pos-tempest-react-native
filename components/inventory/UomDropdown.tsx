import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { UNIT_OF_MEASURE } from '@/constants/enums';
import type { UnitOfMeasure } from '@/constants/enums';
import { ThemeColors } from '@/constants/theme';

export const UOM_OPTIONS: UnitOfMeasure[] = Object.values(UNIT_OF_MEASURE);
export const UOM_LABELS: Record<UnitOfMeasure, string> = {
  piece: 'pcs', kg: 'kg', gram: 'g', ons: 'ons', liter: 'L', ml: 'ml', portion: 'ptn',
};

interface UomDropdownProps {
  value: UnitOfMeasure;
  onChange: (u: UnitOfMeasure) => void;
  disabled?: boolean;
}

export function UomDropdown({ value, onChange, disabled = false }: UomDropdownProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        className="flex-row items-center justify-between rounded-sm border border-border bg-surface px-3"
        style={{ height: 48, opacity: disabled ? 0.5 : 1 }}
      >
        <Text className="text-pos-base font-bold text-pos-text">{UOM_LABELS[value]}</Text>
        <Text className="text-pos-xs text-pos-text-faint">▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: ThemeColors.surfaces.overlay }}
          onPress={() => setOpen(false)}
        >
          <View className="rounded-lg border border-border bg-surface-card overflow-hidden" style={{ width: 200 }}>
            {UOM_OPTIONS.map((u) => (
              <Pressable
                key={u}
                onPress={() => { onChange(u); setOpen(false); }}
                className="flex-row items-center justify-between border-b border-border px-4 py-3"
                style={{ backgroundColor: value === u ? ThemeColors.accent.primaryMuted : 'transparent' }}
              >
                <Text
                  className="text-pos-base font-semibold"
                  style={{ color: value === u ? ThemeColors.accent.primary : ThemeColors.text.primary }}
                >
                  {UOM_LABELS[u]}
                </Text>
                <Text className="text-pos-xs text-pos-text-faint">{u}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
