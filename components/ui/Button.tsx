import clsx from 'clsx';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
  pressOpacity?: number;
  pressScale?: number;
}

export function Button({
  className,
  style,
  disabled,
  children,
  pressOpacity = 0.7,
  pressScale = 0.97,
  onPress,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      className={clsx(className)}
      style={({ pressed }) => [
        typeof style === 'function' ? (style as (state: { pressed: boolean }) => ViewStyle)({ pressed }) : style,
        disabled
          ? { opacity: 0.4 }
          : pressed
            ? { opacity: pressOpacity, transform: [{ scale: pressScale }] }
            : undefined,
      ]}
    >
      {children}
    </Pressable>
  );
}
