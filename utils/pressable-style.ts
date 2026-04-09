import type { ViewStyle } from 'react-native';

/**
 * Returns a pressed-state style object for use with Pressable's `style` prop.
 * Reduces opacity when the element is pressed.
 *
 * @param pressed      Whether the Pressable is currently pressed.
 * @param base         Opacity when not pressed (default: 1).
 * @param pressedValue Opacity when pressed (default: 0.7).
 *
 * @example
 * // Simple usage:
 * style={({ pressed }) => withPressedOpacity(pressed)}
 *
 * // Custom pressed opacity:
 * style={({ pressed }) => withPressedOpacity(pressed, 1, 0.5)}
 *
 * // Spread into an existing style object:
 * style={({ pressed }) => ({ color: 'red', ...withPressedOpacity(pressed) })}
 *
 * // Conditional (e.g. disabled state):
 * style={({ pressed }) => withPressedOpacity(pressed && eligible, eligible ? 1 : 0.45)}
 */
export function withPressedOpacity(
  pressed: boolean,
  base = 1,
  pressedValue = 0.7,
): ViewStyle {
  return { opacity: pressed ? pressedValue : base };
}
