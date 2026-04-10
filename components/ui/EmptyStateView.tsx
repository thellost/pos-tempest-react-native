import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface EmptyStateViewProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

/**
 * Generic centered empty-state with optional icon, subtitle, and action button.
 */
export function EmptyStateView({ icon, title, subtitle, action }: EmptyStateViewProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      {icon && (
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-card">
          {icon}
        </View>
      )}
      <Text className="text-pos-xl font-semibold text-pos-text">{title}</Text>
      {subtitle && (
        <Text className="mt-2 text-center text-pos-base text-pos-muted">{subtitle}</Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          className="mt-6 rounded-2xl bg-brand px-6 py-3.5 active:opacity-80"
        >
          <Text className="text-pos-base font-bold text-white">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
