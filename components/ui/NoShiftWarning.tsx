import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';

interface NoShiftWarningProps {
  /** Optional opening time string (e.g. "09:00"). When combined with `timezone`, shown in the message. */
  openingTime?: string;
  /** Optional timezone label (e.g. "WIB"). Displayed alongside `openingTime`. */
  timezone?: string;
  compact?: boolean;
}

/**
 * Informational banner shown when the auto-shift hasn't opened yet for the day.
 * Shifts are auto-managed; this banner is purely informational and does not block usage.
 */
export function NoShiftWarning({ openingTime, timezone, compact = false }: NoShiftWarningProps) {
  const message =
    openingTime && timezone
      ? `Auto-shift will open at ${openingTime} ${timezone}`
      : "Auto-shift hasn't opened yet for today.";

  if (compact) {
    return (
      <View
        className="flex-row items-center gap-2 border-b border-border px-4 py-2"
        style={{ backgroundColor: ThemeColors.warning.banner }}
      >
        <Info size={14} color={ThemeColors.warning.DEFAULT} />
        <Text className="flex-1 text-pos-xs font-semibold text-pos-warning">
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="mx-4 my-3 flex-row items-center gap-3 rounded-xl border bg-surface-card px-4 py-3"
      style={{ borderColor: ThemeColors.warning.border }}
    >
      <Info size={20} color={ThemeColors.warning.DEFAULT} />
      <View className="flex-1">
        <Text className="text-pos-sm font-bold text-pos-warning">Auto-shift pending</Text>
        <Text className="mt-0.5 text-pos-xs text-pos-muted">{message}</Text>
      </View>
    </View>
  );
}
