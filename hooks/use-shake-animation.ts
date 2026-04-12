import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

export function useShakeAnimation() {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -3, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 30, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const shakeStyle = { transform: [{ translateX: shakeAnim }] };

  return { shakeStyle, triggerShake };
}
