/**
 * Toast POS-inspired color tokens.
 * Used alongside NativeWind/Tailwind — these constants are for JS-side usage
 * (e.g. StatusBar, navigation headers, dynamic styles).
 * The primary styling approach is Tailwind utility classes via `className`.
 */

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundSoft: '#FFFFFF',
    tint: '#2A7FFF',
    icon: '#475569',
    tabIconDefault: '#475569',
    tabIconSelected: '#2A7FFF',
    border: '#CBD5E1',
    muted: '#475569',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
  },
  dark: {
    text: '#E2E8F0',
    background: '#0B1220',
    backgroundSoft: '#121C2E',
    tint: '#2A7FFF',
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#2A7FFF',
    border: '#1E293B',
    muted: '#94A3B8',
    success: '#18A957',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
} as const;

/** Shared brand colors (theme-independent) */
export const Brand = {
  primary: '#2A7FFF',
  primaryHover: '#3F8CFF',
  primaryPress: '#1F6AE0',
} as const;
