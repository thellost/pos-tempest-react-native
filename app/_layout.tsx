import { useEffect } from 'react';

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Modal, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ImmersiveMode from 'react-native-immersive-mode';
import 'react-native-reanimated';

import { PowerSyncProvider } from '@/components/powersync-provider';
import { AppThemeProvider, useAppTheme } from '@/hooks/use-app-theme';
import { AuthProvider } from '@/hooks/use-auth';
import { ConfigProvider } from '@/hooks/use-config';
import { DeviceProvider } from '@/hooks/use-device';

import '../global.css';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

const navigationIntegration = Sentry.reactNavigationIntegration();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? 'https://1c005b8ac82e51e8b9f3d1f6c52528c9@o4511089167695872.ingest.us.sentry.io/4511089168744448',

  environment: __DEV__ ? 'development' : 'production',
  debug: __DEV__,

  // Release tracking
  release: `com.thellost.postempest@${Constants.expoConfig?.version ?? '1.0.0'}`,
  dist: String(Constants.expoConfig?.extra?.eas?.buildNumber ?? '1'),

  sendDefaultPii: true,
  enableLogs: Platform.OS !== 'android',

  // Native frames tracking requires compiled native modules — disable in Expo Go / JS-only builds
  enableNativeFramesTracking: !__DEV__,

  // Sampling — full in dev so nothing is dropped during testing
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
  replaysOnErrorSampleRate: 1,

  integrations: [
    // mobileReplayIntegration requires compiled native modules — unavailable in Expo Go / JS-only builds
    ...(__DEV__ ? [] : [Sentry.mobileReplayIntegration()]),
    Sentry.feedbackIntegration(),
    navigationIntegration,
  ],

  beforeSend(event) {
    // Scrub Authorization headers from outbound events
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }
    return event;
  },
});

function ThemedApp() {
  const navigationRef = useNavigationContainerRef();
  const { themeVars, isThemeChanging } = useAppTheme();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  const [fontsLoaded] = useFonts({
    Geist: require('@/assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('@/assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('@/assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('@/assets/fonts/Geist-Bold.ttf'),
    GeistMono: require('@/assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Bold': require('@/assets/fonts/GeistMono-Bold.ttf'),
  });

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    ImmersiveMode.fullLayout(true);
    ImmersiveMode.setBarMode('FullSticky');
    const sub = ImmersiveMode.addEventListener(() => {
      ImmersiveMode.setBarMode('FullSticky');
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* themeVars applies CSS custom properties to all children */}
      <View style={[{ flex: 1 }, themeVars]} className="font-sans">
        <Modal visible={isThemeChanging} transparent animationType="none" statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        </Modal>
        <ConfigProvider>
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
                {Platform.OS !== 'android' && <StatusBar style="auto" />}
              </ThemeProvider>
            </DeviceProvider>
          </AuthProvider>
        </PowerSyncProvider>
        </ConfigProvider>
      </View>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedApp />
    </AppThemeProvider>
  );
});
