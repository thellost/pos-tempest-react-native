import { Text, View } from 'react-native';

export function RowDivider() {
  return <View className="h-px bg-border" />;
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between px-3.5 py-2.5">
      <Text className="text-pos-xs text-pos-text-muted">{label}</Text>
      <Text className="text-pos-xs font-medium text-pos-text">{value}</Text>
    </View>
  );
}
