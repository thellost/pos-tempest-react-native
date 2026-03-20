import { View } from 'react-native';
import { IconButton } from '@/components/ui';

interface HamburgerButtonProps {
  onPress: () => void;
}

/**
 * Three-bar hamburger icon button.
 * Positioned by the parent (absolute, top-left in the app layout).
 */
export function HamburgerButton({ onPress }: HamburgerButtonProps) {
  return (
    <IconButton
      onPress={onPress}
      size="lg"
      className="bg-surface-raised active:bg-surface-elevated"
      hitSlop={8}
    >
      <View className="h-0.5 w-5 rounded-full bg-pos-text-muted" />
      <View className="mt-1 h-0.5 w-5 rounded-full bg-pos-text-muted" />
      <View className="mt-1 h-0.5 w-5 rounded-full bg-pos-text-muted" />
    </IconButton>
  );
}
