import { Brand } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * Protected main app layout with comprehensive security.
 * Features:
 * - Auth guard (redirects to login if not authenticated)
 * - Lock guard (redirects to PIN if session locked)
 * - Activity tracking on all interactions
 * - Session validation
 */
export default function AppLayout() {
  const { loading, isAuthenticated, isLocked, markActivity, user, signOut } = useAuth();

  // Show loading while checking session
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-muted">Loading...</Text>
      </View>
    );
  }

  // Auth guard: redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Lock guard: redirect to PIN if session locked
  if (isLocked) {
    return <Redirect href="/(auth)/pin" />;
  }

  // Security check: ensure user profile is loaded
  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <Text className="mb-4 text-center text-pos-lg font-semibold text-pos-text-strong">
          Profile Loading Error
        </Text>
        <Text className="mb-6 text-center text-pos-sm text-pos-muted">
          Unable to load user profile. Please try logging in again.
        </Text>
        <Pressable
          className="rounded-lg bg-brand px-6 py-3"
          onPress={() => {
            // Force navigate to login (will trigger signOut via auth layout)
            window.location.reload?.(); // For web
          }}>
          <Text className="text-pos-base font-semibold text-white">Reload</Text>
        </Pressable>
      </View>
    );
  }

  // Security check: ensure user is active
  if (!user.is_active) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <Text className="mb-4 text-center text-pos-lg font-semibold text-pos-text-strong">
          Account Inactive
        </Text>
        <Text className="mb-6 text-center text-pos-sm text-pos-muted">
          Your account has been deactivated. Please contact your administrator.
        </Text>
        <Pressable
          className="rounded-lg border border-white/10 bg-surface-soft px-6 py-3"
          onPress={async () => {
            await signOut();
          }}>
          <Text className="text-pos-base font-semibold text-pos-text-strong">Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  // Render protected app with activity tracking
  return (
    <View 
      className="flex-1" 
      onTouchStart={markActivity} 
      onTouchMove={markActivity}
      onResponderGrant={markActivity}
      onResponderMove={markActivity}>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }}>
        {/* Main screens */}
        <Stack.Screen 
          name="floor/index" 
          options={{ title: 'Floor View' }} 
        />
        <Stack.Screen 
          name="order/[tableId]" 
          options={{ title: 'Order' }} 
        />
        <Stack.Screen 
          name="menu/index" 
          options={{ title: 'Menu' }} 
        />
        <Stack.Screen 
          name="kitchen/index" 
          options={{ title: 'Kitchen Display' }} 
        />
        <Stack.Screen 
          name="checkout/[orderId]" 
          options={{ title: 'Checkout' }} 
        />
        <Stack.Screen 
          name="settings/index" 
          options={{ title: 'Settings' }} 
        />
        <Stack.Screen 
          name="shifts/index" 
          options={{ title: 'Shifts' }} 
        />
        <Stack.Screen 
          name="inventory/index" 
          options={{ title: 'Inventory' }} 
        />
        <Stack.Screen 
          name="customers/index" 
          options={{ title: 'Customers' }} 
        />
        <Stack.Screen 
          name="reports/index" 
          options={{ title: 'Reports' }} 
        />
      </Stack>
    </View>
  );
}
