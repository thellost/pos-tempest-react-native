import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

/**
 * Order screen - menu + order panel.
 * To be implemented in Step 6.
 */
export default function OrderScreen() {
  const { tableId } = useLocalSearchParams<{ tableId: string }>();

  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Text className="text-pos-xl text-pos-text">Order Screen (Step 6)</Text>
      <Text className="text-pos-base text-pos-muted">Table ID: {tableId}</Text>
    </View>
  );
}
