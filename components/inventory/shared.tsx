import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

import { ThemeColors } from '@/constants/theme';

export function formatQty(qty: number) {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/\.?0+$/, '');
}

export function SectionHeader({ title, onRefresh, refreshing }: { title: string; onRefresh: () => void; refreshing: boolean }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border bg-surface-card px-4 py-3">
      <Text className="text-pos-xl font-bold text-pos-text">{title}</Text>
      <Pressable onPress={onRefresh} disabled={refreshing} hitSlop={8} className="p-1">
        {refreshing
          ? <ActivityIndicator size="small" color={ThemeColors.accent.primary} />
          : <RefreshCw size={18} color={ThemeColors.text.muted} />}
      </Pressable>
    </View>
  );
}

export function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <View className="items-center justify-center py-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
        {icon}
      </View>
      <Text className="text-pos-base text-pos-text-muted">{message}</Text>
    </View>
  );
}
