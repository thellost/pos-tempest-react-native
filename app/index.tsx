import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Root index - smart route handler with auth state detection.
 * Determines where to navigate based on:
 * - Authentication status
 * - Lock status
 * - Session validity
 */
export default function Index() {
  const { loading, isAuthenticated, isLocked } = useAuth();

  // Show loading while checking authentication status
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <View className="items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-pos-base text-pos-muted">Initializing...</Text>
        </View>
      </View>
    );
  }

  // Route based on authentication and lock status
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLocked) {
    return <Redirect href="/(auth)/pin" />;
  }

  // Authenticated and unlocked - go to main app
  return <Redirect href="/(app)/floor" />;
}
