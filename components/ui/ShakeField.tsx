import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { ViewProps } from 'react-native';

import { useShakeAnimation } from '@/hooks/use-shake-animation';

export interface ShakeFieldRef {
  shake: () => void;
}

interface ShakeFieldProps extends ViewProps {
  children: React.ReactNode;
}

export const ShakeField = forwardRef<ShakeFieldRef, ShakeFieldProps>(
  function ShakeField({ children, style, ...props }, ref) {
    const { shakeStyle, triggerShake } = useShakeAnimation();

    useImperativeHandle(ref, () => ({
      shake: triggerShake,
    }));

    return (
      <Animated.View style={[shakeStyle, style]} {...props}>
        {children}
      </Animated.View>
    );
  }
);
