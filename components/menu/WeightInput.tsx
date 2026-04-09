import { Text, TextInput, View } from 'react-native';

interface WeightInputProps {
  value: string;
  unitLabel: string;
  onChange: (next: string) => void;
}
export function WeightInput({
  value,
  unitLabel,
  onChange,
}: WeightInputProps) {
  const handleChange = (text: string) => {
    // Normalize locale decimal separators (e.g. "0,5" → "0.5")
    const normalized = text.replace(',', '.');
    // Strip anything that isn't a digit or the first decimal point
    const filtered = normalized.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    onChange(filtered);
  };

  return (
    <View className="rounded-2xl bg-surface-card p-4">
      <View className="flex-row items-end justify-between">
        <Text className="text-pos-sm text-pos-text-muted">Weight</Text>
        <Text className="text-pos-sm text-pos-text-muted">{unitLabel}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder="0"
        placeholderTextColor="#64748B"
        keyboardType="decimal-pad"
        className="mt-3 rounded-xl bg-surface-raised px-4 py-3 text-pos-lg font-semibold text-pos-text"
      />
    </View>
  );
}
