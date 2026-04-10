import { Pressable, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';

interface NoShiftWarningProps {
  onOpenShift?: () => void;
  compact?: boolean;
}

/**
 * Warning banner displayed when no shift is open.
 * Use `compact` for inline banners (e.g. inside order panels).
 */
export function NoShiftWarning({ onOpenShift, compact = false }: NoShiftWarningProps) {
  if (compact) {
    return (
      <View
        className="flex-row items-center gap-2 border-b border-border px-4 py-2"
        style={{ backgroundColor: ThemeColors.warning.banner }}
      >
        <AlertTriangle size={14} color={ThemeColors.warning.DEFAULT} />
        <Text className="flex-1 text-pos-xs font-semibold text-pos-warning">
          No shift open — open a shift to create or modify orders
        </Text>
        {onOpenShift && (
          <Pressable
            onPress={onOpenShift}
            className="rounded bg-surface-raised px-2.5 py-1 active:opacity-70"
          >
            <Text className="text-pos-xs font-bold text-pos-warning">Open Shift</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      className="mx-4 my-3 flex-row items-center gap-3 rounded-xl border px-4 py-3 bg-surface-card"
      style={{ borderColor: ThemeColors.warning.border }}
    >
      <AlertTriangle size={20} color={ThemeColors.warning.DEFAULT} />
      <View className="flex-1">
        <Text className="text-pos-sm font-bold text-pos-warning">No shift open</Text>
        <Text className="mt-0.5 text-pos-xs text-pos-muted">
          A shift must be open before taking orders.
        </Text>
      </View>
      {onOpenShift && (
        <Pressable
          onPress={onOpenShift}
          className="rounded-lg bg-surface-raised px-3 py-2 active:opacity-70"
          style={{ borderColor: ThemeColors.warning.border, borderWidth: 1 }}
        >
          <Text className="text-pos-sm font-bold text-pos-warning">Open Shift</Text>
        </Pressable>
      )}
    </View>
  );
}
