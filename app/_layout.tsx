import { useEffect } from 'react';

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { PowerSyncProvider } from '@/components/powersync-provider';
import { AuthProvider } from '@/hooks/use-auth';
import { DeviceProvider } from '@/hooks/use-device';

import '../global.css';

export default function RootLayout() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PowerSyncProvider>
        <AuthProvider>
          <DeviceProvider>
            <ThemeProvider value={DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </DeviceProvider>
        </AuthProvider>
      </PowerSyncProvider>
    </GestureHandlerRootView>
  );
}
