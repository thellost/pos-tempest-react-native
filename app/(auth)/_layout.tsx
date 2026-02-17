import { useAuth } from '@/hooks/use-auth';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Auth layout - for unauthenticated screens (login, PIN).
 * To be implemented in Step 3.
 */
export default function AuthLayout() {
  const { loading, isAuthenticated, isLocked } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated && !isLocked) {
    return <Redirect href="/(app)/floor" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="pin" />
    </Stack>
  );
}
