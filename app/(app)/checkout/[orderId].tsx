import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

/**
 * Checkout/Payment screen.
 * To be implemented in Step 9.
 */
export default function CheckoutScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Text className="text-pos-xl text-pos-text">Checkout Screen (Step 9)</Text>
      <Text className="text-pos-base text-pos-muted">Order ID: {orderId}</Text>
    </View>
  );
}
