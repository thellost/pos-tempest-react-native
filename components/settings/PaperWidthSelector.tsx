import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { type PaperWidth } from '@/hooks/use-printer';
import { SelectButton } from '@/components/ui';

const PAPER_WIDTH_PRESETS: PaperWidth[] = [48, 58, 72, 76, 80];

export type PaperWidthSelectorProps = {
  value: PaperWidth;
  placeholderColor: string;
  onChange: (w: PaperWidth) => void;
};

export function PaperWidthSelector({ value, placeholderColor, onChange }: PaperWidthSelectorProps) {
  const isCustom = !PAPER_WIDTH_PRESETS.includes(value);
  const [customInput, setCustomInput] = useState(isCustom ? String(value) : '');
  const [showCustom, setShowCustom] = useState(isCustom);

  const handlePreset = (w: PaperWidth) => {
    setShowCustom(false);
    setCustomInput('');
    onChange(w);
  };

  const handleCustomChange = (text: string) => {
    setCustomInput(text);
    const n = parseInt(text, 10);
    if (!isNaN(n) && n >= 24 && n <= 120) onChange(n);
  };

  return (
    <View className="gap-2">
      <Text className="text-pos-xs text-pos-text-muted">Paper Width</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {PAPER_WIDTH_PRESETS.map((w) => (
          <SelectButton
            key={w}
            selected={!showCustom && value === w}
            selectedClassName="border-brand bg-brand"
            unselectedClassName="border-border bg-surface"
            className="rounded-lg px-3 py-2"
            onPress={() => handlePreset(w)}
          >
            <Text className={`text-pos-xs font-semibold ${!showCustom && value === w ? 'text-white' : 'text-pos-text'}`}>
              {w}mm
            </Text>
          </SelectButton>
        ))}
        <SelectButton
          selected={showCustom}
          selectedClassName="border-brand bg-brand"
          unselectedClassName="border-border bg-surface"
          className="rounded-lg px-3 py-2"
          onPress={() => setShowCustom(true)}
        >
          <Text className={`text-pos-xs font-semibold ${showCustom ? 'text-white' : 'text-pos-text'}`}>
            Custom
          </Text>
        </SelectButton>
      </View>
      {showCustom && (
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-pos-sm text-pos-text"
            placeholder="e.g. 68"
            placeholderTextColor={placeholderColor}
            value={customInput}
            onChangeText={handleCustomChange}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text className="text-pos-xs text-pos-text-muted">mm (24–120)</Text>
        </View>
      )}
    </View>
  );
}
