import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { ThemeColors } from '@/constants/theme';
import { useOnlineCheck } from '@/hooks/use-online-check';

/**
 * Inventory management screen.
 * Requires backend connectivity — checks /health before rendering content.
 * To be implemented in Step 11.
 */
export default function InventoryScreen() {
  const { isOnline, isChecking, checkOnline } = useOnlineCheck();

  useEffect(() => {
    checkOnline();
  }, [checkOnline]);

  if (isChecking || isOnline === null) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={ThemeColors.accent.primary} />
        <Text className="mt-4 text-pos-base text-pos-text-muted">Checking connection...</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          <WifiOff size={32} color={ThemeColors.text.muted} />
        </View>
        <Text className="text-pos-xl font-semibold text-pos-text">No Connection</Text>
        <Text className="mt-2 text-center text-pos-base text-pos-text-muted">
          Inventory Management requires an internet connection for backend verification.
        </Text>
        <Button
          onPress={checkOnline}
          className="mt-6 rounded-sm bg-brand px-6 py-3"
        >
          <Text className="text-pos-base font-semibold text-white">Retry</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Text className="text-pos-xl text-pos-text">Inventory Screen (Step 11)</Text>
    </View>
  );
}
