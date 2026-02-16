import { Stack } from 'expo-router';

/**
 * Main app layout - protected routes.
 * To be implemented in Step 3 with auth guard.
 */
export default function AppLayout() {
  return (
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
  );
}
