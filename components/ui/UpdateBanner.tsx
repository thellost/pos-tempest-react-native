import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowDownToLine, RefreshCw, X } from 'lucide-react-native';

import { useOtaUpdate } from '@/hooks/use-ota-update';

/**
 * Non-intrusive banner shown when an OTA update has been downloaded
 * and is ready to apply.  Tapping restarts the app; the × dismisses
 * the banner until the next foreground cycle.
 */
export function UpdateBanner() {
  const { isDownloading, isReady, restart } = useOtaUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!isDownloading && !isReady)) return null;

  return (
    <View className="bg-brand px-4 py-2.5">
      {isDownloading ? (
        <View className="flex-row items-center justify-center gap-2">
          <ArrowDownToLine size={14} color="#fff" />
          <Text className="text-pos-xs font-medium text-white">
            Downloading update…
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={restart}
            className="flex-1 flex-row items-center gap-2 active:opacity-80"
          >
            <RefreshCw size={14} color="#fff" />
            <Text className="text-pos-xs font-semibold text-white">
              Update ready — Tap to restart
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDismissed(true)}
            hitSlop={12}
            className="ml-3 rounded-full p-1 active:opacity-60"
          >
            <X size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
