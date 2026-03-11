import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Redirect, Stack, usePathname } from 'expo-router';

import { HamburgerButton } from '@/components/navigation/HamburgerButton';
import { SideDrawer } from '@/components/navigation/SideDrawer';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { useShift } from '@/hooks/use-shift';

export default function AppLayout() {
  const { loading, profileLoading, isAuthenticated, isLocked, markActivity, user, signOut, lock, refreshProfile } = useAuth();
  const { loading: deviceLoading, isRegistered, registration } = useDevice();
  const { loading: shiftLoading, requiresShift, isShiftOpen } = useShift();
  const pathname = usePathname();

  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Profile is still being fetched (waiting for PowerSync initial sync)
  if (profileLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text className="mt-4 text-pos-sm text-pos-text-muted">Loading profile…</Text>
        <Text className="mt-2 text-pos-xs text-pos-text-muted">Waiting for data sync…</Text>
      </View>
    );
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
          Unable to load user profile. This may happen if the device has no internet connection on first launch. Please check your connection and try again.
        </Text>
        <Pressable
          className="mb-3 w-full rounded-xl bg-brand px-6 py-3"
          onPress={() => {
            refreshProfile().catch(() => {});
          }}>
          <Text className="text-center text-pos-base font-semibold text-white">Retry</Text>
        </Pressable>
        <Pressable
          className="w-full rounded-xl border border-border bg-surface-card px-6 py-3"
          onPress={async () => {
            await signOut();
          }}>
          <Text className="text-center text-pos-base font-semibold text-pos-text">Sign Out</Text>
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

  // Shift guards only apply once the device is registered.
  // Without this gate, an unregistered device would loop between
  // /device-setup ↔ /shifts because each redirects to the other.
  if (isRegistered) {
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
  }

  return (
    <View className="flex-1 flex-row">
      {/* Left rail — hamburger button lives here, never overlaps content */}
      <View className="w-14 items-center border-r border-border bg-surface-card pt-3">
        <HamburgerButton onPress={() => setDrawerOpen((v) => !v)} />
      </View>

      {/* Main content area */}
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
            name="cash/index"
            options={{ title: 'Cash Management' }}
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

        {/* Branch / device badge — top-right of content area */}
        {isRegistered && registration?.branch && (
          <View className="absolute top-3 right-3 rounded-xl bg-surface-card/90 px-4 py-2">
            <Text className="text-pos-xs text-pos-text-muted">
              {registration.device?.device_name} • {registration.branch.name}
            </Text>
          </View>
        )}
      </View>

      {/* Side drawer — renders on top of everything */}
      <SideDrawer
        isOpen={drawerOpen}
        user={user}
        onClose={() => setDrawerOpen(false)}
        onSignOut={async () => {
          setDrawerOpen(false);
          await signOut();
        }}
        onLock={() => {
          setDrawerOpen(false);
          lock();
        }}
      />
    </View>
  );
}
