import { useAuth } from '@/hooks/use-auth';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Main app layout - protected routes.
 * To be implemented in Step 3 with auth guard.
 */
export default function AppLayout() {
  const { loading, isAuthenticated, isLocked, markActivity } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLocked) {
    return <Redirect href="/(auth)/pin" />;
  }

  return (
    <View className="flex-1" onTouchStart={markActivity} onTouchMove={markActivity}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="floor/index" />
        <Stack.Screen name="order/[tableId]" />
        <Stack.Screen name="menu/index" />
        <Stack.Screen name="kitchen/index" />
        <Stack.Screen name="checkout/[orderId]" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="shifts/index" />
        <Stack.Screen name="inventory/index" />
        <Stack.Screen name="customers/index" />
        <Stack.Screen name="reports/index" />
      </Stack>
    </View>
  );
}
