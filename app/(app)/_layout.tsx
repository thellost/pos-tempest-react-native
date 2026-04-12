import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Redirect, router, Stack, usePathname, useSegments } from 'expo-router';
import { AlertTriangle, Ban } from 'lucide-react-native';

import { AppErrorBoundary } from '@/components/ErrorBoundary';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { IconRail } from '@/components/navigation/IconRail';
import { AppStatusBar } from '@/components/navigation/StatusBar';
import { Button } from '@/components/ui';
import { MAIN_NAV, SYSTEM_NAV } from '@/constants/navigation';
import { PERMISSION } from '@/constants/permissions';
import type { Permission } from '@/constants/permissions';
import { Brand, ThemeColors } from '@/constants/theme';
import { useAppTimezone } from '@/hooks/use-app-timezone';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { useLayout } from '@/hooks/use-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useShift } from '@/hooks/use-shift';

/** Route segments that require a specific permission to access. */
const ROUTE_PERMISSIONS: Record<string, Permission> = {
  inventory: PERMISSION.VIEW_INVENTORY,
  reports: PERMISSION.VIEW_REPORTS,
  'daily-orders': PERMISSION.VIEW_REPORTS,
  shifts: PERMISSION.MANAGE_SHIFT,
  cash: PERMISSION.MANAGE_SHIFT,
  reservations: PERMISSION.VIEW_RESERVATIONS,
};

export default function AppLayout() {
  useAppTimezone();
  const { loading, profileLoading, isAuthenticated, isLocked, markActivity, user, signOut, lock, refreshProfile } = useAuth();
  const { can } = usePermissions();
  const segments = useSegments();

  useEffect(() => {
    if (!user) return;

    // Find the first segment after "(app)" that matches a guarded route.
    const routeSegment = segments.find((s) => s in ROUTE_PERMISSIONS);
    if (!routeSegment) return;

    const required = ROUTE_PERMISSIONS[routeSegment];
    if (!can(required)) {
      router.replace('/(app)/floor');
    }
  }, [segments, user, can]);

  const { loading: deviceLoading, isRegistered, registration } = useDevice();
  const { loading: shiftLoading, requiresShift, isShiftOpen } = useShift();
  const { isPhone } = useLayout();
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
          <AlertTriangle size={32} color={ThemeColors.warning.DEFAULT} />
        </View>
        <Text className="mb-4 text-center text-pos-lg font-semibold text-pos-text">
          Profile Loading Error
        </Text>
        <Text className="mb-6 text-center text-pos-sm text-pos-text-muted">
          Unable to load user profile. This may happen if the device has no internet connection on first launch. Please check your connection and try again.
        </Text>
        <Button
          className="mb-3 w-full rounded-xl bg-brand px-6 py-3"
          onPress={() => {
            refreshProfile().catch(() => {});
          }}>
          <Text className="text-center text-pos-base font-semibold text-white">Retry</Text>
        </Button>
        <Button
          className="w-full rounded-xl border border-border bg-surface-card px-6 py-3"
          onPress={async () => {
            await signOut();
          }}>
          <Text className="text-center text-pos-base font-semibold text-pos-text">Sign Out</Text>
        </Button>
      </View>
    );
  }

  if (!user.is_active) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <Ban size={32} color={ThemeColors.danger.DEFAULT} />
        </View>
        <Text className="mb-4 text-center text-pos-lg font-semibold text-pos-text">
          Account Inactive
        </Text>
        <Text className="mb-6 text-center text-pos-sm text-pos-text-muted">
          Your account has been deactivated. Please contact your administrator.
        </Text>
        <Button
          className="rounded-xl border border-border bg-surface-card px-6 py-3"
          onPress={async () => {
            await signOut();
          }}>
          <Text className="text-pos-base font-semibold text-pos-text">Sign Out</Text>
        </Button>
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
    <AppErrorBoundary>
    <View className="flex-1">
      {/* Top status bar — user, clock, shift, orders, device */}
      <AppStatusBar
        user={user}
        isShiftOpen={isShiftOpen}
        activeOrdersCount={0}
        deviceName={registration?.device?.device_name ?? ''}
        branchName={registration?.branch?.name ?? ''}
        compact={isPhone}
      />

      {isPhone ? (
        /* Phone layout: full-width content + bottom tab bar */
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
                animation: 'none',
              }}>
              <Stack.Screen name="floor/index"        options={{ title: 'Floor View' }} />
              <Stack.Screen name="order/[tableId]"    options={{ title: 'Order' }} />
              <Stack.Screen name="kitchen/index"      options={{ title: 'Kitchen Display' }} />
              <Stack.Screen name="checkout/[orderId]" options={{ title: 'Checkout' }} />
              <Stack.Screen name="settings/index"     options={{ title: 'Settings' }} />
              <Stack.Screen name="shifts/index"       options={{ title: 'Shifts' }} />
              <Stack.Screen name="cash/index"         options={{ title: 'Cash Management' }} />
              <Stack.Screen name="inventory/index"    options={{ title: 'Inventory' }} />
              <Stack.Screen name="daily-orders/index" options={{ title: 'Daily Orders' }} />
              <Stack.Screen name="reservations/index" options={{ title: 'Reservations' }} />
              <Stack.Screen name="customers/index"    options={{ title: 'Customers' }} />
              <Stack.Screen name="device-setup"       options={{ title: 'Device Setup' }} />
            </Stack>
          </View>
          <BottomTabBar isShiftOpen={isShiftOpen} />
        </View>
      ) : (
        /* Tablet layout: icon rail on left + content on right */
        <View className="flex-1 flex-row">
          {/* Persistent icon rail */}
          <IconRail
            navItems={[...MAIN_NAV, ...SYSTEM_NAV]}
            currentPath={pathname}
            onNavigate={(href) => router.push(href as Parameters<typeof router.push>[0])}
            user={user}
            userRole={user?.role_name?.toLowerCase() ?? ''}
            isShiftOpen={isShiftOpen}
            onLock={lock}
            onSignOut={signOut}
          />

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
                animation: 'none',
              }}>
              <Stack.Screen name="floor/index"        options={{ title: 'Floor View' }} />
              <Stack.Screen name="order/[tableId]"    options={{ title: 'Order' }} />
              <Stack.Screen name="kitchen/index"      options={{ title: 'Kitchen Display' }} />
              <Stack.Screen name="checkout/[orderId]" options={{ title: 'Checkout' }} />
              <Stack.Screen name="settings/index"     options={{ title: 'Settings' }} />
              <Stack.Screen name="shifts/index"       options={{ title: 'Shifts' }} />
              <Stack.Screen name="cash/index"         options={{ title: 'Cash Management' }} />
              <Stack.Screen name="inventory/index"    options={{ title: 'Inventory' }} />
              <Stack.Screen name="daily-orders/index" options={{ title: 'Daily Orders' }} />
              <Stack.Screen name="reservations/index" options={{ title: 'Reservations' }} />
              <Stack.Screen name="customers/index"    options={{ title: 'Customers' }} />
              <Stack.Screen name="device-setup"       options={{ title: 'Device Setup' }} />
            </Stack>
          </View>
        </View>
      )}
    </View>
    </AppErrorBoundary>
  );
}
