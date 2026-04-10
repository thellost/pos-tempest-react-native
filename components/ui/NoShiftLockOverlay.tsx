import { Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';

interface NoShiftLockOverlayProps {
  visible: boolean;
  message?: string;
}

/**
 * Semi-transparent overlay that blocks interaction when no shift is open.
 * Renders nothing when `visible` is false.
 */
export function NoShiftLockOverlay({
  visible,
  message = 'Open a shift to start taking orders',
}: NoShiftLockOverlayProps) {
  if (!visible) return null;

  return (
    <View
      className="absolute bottom-0 left-0 right-0 top-0 z-10 items-center justify-center"
      style={{ backgroundColor: ThemeColors.surfaces.overlay }}
    >
      <View className="items-center rounded-2xl bg-surface-card px-10 py-8">
        <Lock size={36} color={ThemeColors.text.muted} style={{ marginBottom: 8 }} />
        <Text className="text-pos-lg font-bold text-pos-text">No Active Shift</Text>
        <Text className="mt-1 text-center text-pos-sm text-pos-muted">{message}</Text>
      </View>
    </View>
  );
}
