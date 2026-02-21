import { Brand } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { useShift } from '@/hooks/use-shift';
import { Redirect, router, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

export default function AppLayout() {
  const { loading, isAuthenticated, isLocked, markActivity, user, signOut } = useAuth();
  const { loading: deviceLoading, isRegistered, registration } = useDevice();
  const { loading: shiftLoading, requiresShift, isShiftOpen } = useShift();
  const pathname = usePathname();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-text-muted">Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLocked) {
    return <Redirect href="/(auth)/pin" />;
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <Text className="text-3xl">⚠️</Text>
        </View>
        <Text className="mb-4 text-center text-pos-lg font-semibold text-pos-text">
          Profile Loading Error
        </Text>
        <Text className="mb-6 text-center text-pos-sm text-pos-text-muted">
          Unable to load user profile. Please try logging in again.
        </Text>
        <Pressable
          className="rounded-xl bg-accent px-6 py-3"
          onPress={() => {
            window.location.reload?.();
          }}>
          <Text className="text-pos-base font-semibold text-white">Reload</Text>
        </Pressable>
      </View>
    );
  }

  if (!user.is_active) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <Text className="text-3xl">🚫</Text>
        </View>
        <Text className="mb-4 text-center text-pos-lg font-semibold text-pos-text">
          Account Inactive
        </Text>
        <Text className="mb-6 text-center text-pos-sm text-pos-text-muted">
          Your account has been deactivated. Please contact your administrator.
        </Text>
        <Pressable
          className="rounded-xl border border-border bg-surface-card px-6 py-3"
          onPress={async () => {
            await signOut();
          }}>
          <Text className="text-pos-base font-semibold text-pos-text">Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  const onDeviceSetupScreen = pathname === '/device-setup';

  if (deviceLoading && !onDeviceSetupScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-text-muted">Checking device registration...</Text>
      </View>
    );
  }

  if (!isRegistered && !onDeviceSetupScreen) {
    return <Redirect href="/(app)/device-setup" />;
  }

  const onShiftScreen = pathname.startsWith('/shifts');

  if (requiresShift && shiftLoading && !onShiftScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-text-muted">Checking shift status...</Text>
      </View>
    );
  }

  if (requiresShift && !isShiftOpen && !onShiftScreen) {
    return <Redirect href="/(app)/shifts" />;
  }

  return (
    <View className="flex-1">
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
          <Stack.Screen 
            name="device-setup" 
            options={{ title: 'Device Setup' }} 
          />
        </Stack>
      </View>

      {isRegistered && registration?.branch && (
        <View className="absolute top-3 right-3 rounded-xl bg-surface-card/90 px-4 py-2">
          <Text className="text-pos-xs text-pos-text-muted">
            {registration.device?.device_name} • {registration.branch.name}
          </Text>
        </View>
      )}

      <View className="border-t border-border bg-surface-card px-4 py-3">
        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 flex-row items-center justify-center rounded-xl bg-accent px-4 py-3"
            onPress={() => router.push('/explore')}>
            <Text className="text-pos-base font-semibold text-white">Dashboard</Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center rounded-xl bg-pos-danger-muted px-4 py-3"
            onPress={async () => {
              await signOut();
            }}>
            <Text className="text-pos-base font-semibold text-pos-danger">Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
