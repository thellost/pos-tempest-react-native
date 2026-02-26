import { Pressable, View } from 'react-native';

interface HamburgerButtonProps {
  onPress: () => void;
}

/**
 * Three-bar hamburger icon button.
 * Positioned by the parent (absolute, top-left in the app layout).
 */
export function HamburgerButton({ onPress }: HamburgerButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-lg bg-surface-raised active:bg-surface-elevated"
      hitSlop={8}
    >
      <View className="h-0.5 w-5 rounded-full bg-pos-text-muted" />
      <View className="mt-1 h-0.5 w-5 rounded-full bg-pos-text-muted" />
      <View className="mt-1 h-0.5 w-5 rounded-full bg-pos-text-muted" />
    </Pressable>
  );
}
