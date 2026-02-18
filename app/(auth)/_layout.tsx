import { useAuth } from '@/hooks/use-auth';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

/**
 * Auth layout for unauthenticated screens (login, PIN).
 * Handles:
 * - Loading state while checking session
 * - Auto-redirect to app if authenticated and unlocked
 * - Redirect to PIN if authenticated but locked
 */
export default function AuthLayout() {
  const { loading, isAuthenticated, isLocked } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-pos-sm text-pos-muted">Loading...</Text>
      </View>
    );
  }

  // If authenticated and not locked, redirect to main app
  if (isAuthenticated && !isLocked) {
    return <Redirect href="/(app)/floor" />;
  }

  // If authenticated but locked, ensure we're on PIN screen
  if (isAuthenticated && isLocked) {
    return <Redirect href="/(auth)/pin" />;
  }

  // Not authenticated - show auth screens
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: 'fade',
        gestureEnabled: false, // Prevent swipe back on auth screens
      }}>
      <Stack.Screen 
        name="login" 
        options={{ 
          title: 'Login',
        }} 
      />
      <Stack.Screen 
        name="pin" 
        options={{ 
          title: 'Unlock',
        }} 
      />
    </Stack>
  );
}
