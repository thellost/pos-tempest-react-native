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
  return (
    <View className="rounded-2xl bg-surface-card p-4">
      <View className="flex-row items-end justify-between">
        <Text className="text-pos-sm text-pos-text-muted">Weight</Text>
        <Text className="text-pos-sm text-pos-text-muted">{unitLabel}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor="#64748B"
        keyboardType="numeric"
        className="mt-3 rounded-xl bg-surface-raised px-4 py-3 text-pos-lg font-semibold text-pos-text"
      />
    </View>
  );
}
