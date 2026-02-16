import { Stack } from 'expo-router';

/**
 * Auth layout - for unauthenticated screens (login, PIN).
 * To be implemented in Step 3.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="pin" />
    </Stack>
  );
}
