/**
 * Modern Dark SaaS Dashboard UI Color Tokens
 * 
 * Design System:
 * - Dark charcoal / near-black backgrounds
 * - Soft gradients with subtle elevation
 * - Rounded cards with large border-radius
 * - Subtle shadows (not harsh)
 * - Muted color palette with bright accent buttons
 * - High contrast typography
 * - Soft glow highlights
 * 
 * All colors are centralized here for easy theming.
 */

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundSoft: '#FFFFFF',
    tint: '#6366F1',
    icon: '#475569',
    tabIconDefault: '#475569',
    tabIconSelected: '#6366F1',
    border: '#CBD5E1',
    muted: '#475569',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    white: '#FFFFFF',
  },
  dark: {
    text: '#E2E8F0',
    background: '#0C0F14',
    backgroundSoft: '#141820',
    tint: '#6366F1',
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#818CF8',
    border: '#1E293B',
    muted: '#64748B',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    white: '#FFFFFF',
  },
} as const;

/**
 * Theme Color System
 * All UI colors are defined here for easy replacement
 */
export const ThemeColors = {
  surfaces: {
    base: '#0C0F14',
    soft: '#141820',
    card: '#1A1F2C',
    raised: '#222838',
    elevated: '#2A3142',
    overlay: 'rgba(0, 0, 0, 0.75)',
    disabled: '#374151',
  },
  borders: {
    default: 'rgba(255, 255, 255, 0.06)',
    subtle: 'rgba(255, 255, 255, 0.04)',
    medium: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.12)',
    focus: '#6366F1',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#E2E8F0',
    muted: '#94A3B8',
    faint: '#64748B',
    inverse: '#0F172A',
    strong: '#FFFFFF',
    inactive: '#9CA3AF',
  },
  accent: {
    primary: '#6366F1',
    primaryHover: '#818CF8',
    primaryPress: '#4F46E5',
    primaryMuted: 'rgba(99, 102, 241, 0.15)',
    primaryGlow: 'rgba(99, 102, 241, 0.25)',
    primarySubtle: 'rgba(99, 102, 241, 0.10)',
    primaryLight: 'rgba(99, 102, 241, 0.12)',
    primaryBadge: 'rgba(99, 102, 241, 0.22)',
    primaryDisabled: 'rgba(99, 102, 241, 0.20)',
    primaryBorder: 'rgba(99, 102, 241, 0.30)',
  },
  success: {
    DEFAULT: '#10B981',
    hover: '#34D399',
    press: '#059669',
    muted: 'rgba(16, 185, 129, 0.15)',
    glow: 'rgba(16, 185, 129, 0.25)',
    light: 'rgba(16, 185, 129, 0.10)',
    dim: 'rgba(16, 185, 129, 0.06)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  warning: {
    DEFAULT: '#F59E0B',
    hover: '#FBBF24',
    press: '#D97706',
    muted: 'rgba(245, 158, 11, 0.15)',
    glow: 'rgba(245, 158, 11, 0.25)',
    dim: 'rgba(245, 158, 11, 0.06)',
    banner: 'rgba(245, 158, 11, 0.08)',
    badge: 'rgba(245, 158, 11, 0.20)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  danger: {
    DEFAULT: '#EF4444',
    hover: '#F87171',
    press: '#DC2626',
    muted: 'rgba(239, 68, 68, 0.15)',
    glow: 'rgba(239, 68, 68, 0.25)',
    badge: 'rgba(239, 68, 68, 0.20)',
  },
  info: {
    DEFAULT: '#3B82F6',
    border: 'rgba(59, 130, 246, 0.35)',
    bg: 'rgba(59, 130, 246, 0.06)',
  },
  category: {
    food: '#F97316',
    drinks: '#3B82F6',
    desserts: '#EC4899',
    specials: '#8B5CF6',
    default: '#475569',
  },
  status: {
    available: '#10B981',
    availableMuted: 'rgba(16, 185, 129, 0.15)',
    occupied: '#EF4444',
    occupiedMuted: 'rgba(239, 68, 68, 0.15)',
    reserved: '#F59E0B',
    reservedMuted: 'rgba(245, 158, 11, 0.15)',
    maintenance: '#6B7280',
    maintenanceMuted: 'rgba(107, 114, 128, 0.15)',
  },
  shadows: {
    small: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.2)',
    large: 'rgba(0, 0, 0, 0.3)',
    glow: 'rgba(99, 102, 241, 0.15)',
  },
} as const;

/**
 * Light Theme Color System
 * Mirror of ThemeColors for light mode — light surfaces, dark text, dark-overlay borders.
 */
export const LightThemeColors = {
  surfaces: {
    base:     '#F8FAFC',
    soft:     '#FFFFFF',
    card:     '#FFFFFF',
    raised:   '#F1F5F9',
    elevated: '#E2E8F0',
    overlay:  'rgba(0, 0, 0, 0.5)',
    disabled: '#D1D5DB',
  },
  borders: {
    default: 'rgba(0, 0, 0, 0.08)',
    subtle:  'rgba(0, 0, 0, 0.05)',
    medium:  'rgba(0, 0, 0, 0.10)',
    strong:  'rgba(0, 0, 0, 0.15)',
    focus:   '#6366F1',
  },
  text: {
    primary:  '#0F172A',
    secondary: '#1E293B',
    muted:    '#475569',
    faint:    '#94A3B8',
    inverse:  '#F8FAFC',
    strong:   '#000000',
    inactive: '#9CA3AF',
  },
  accent: {
    primary:         '#6366F1',
    primaryHover:    '#818CF8',
    primaryPress:    '#4F46E5',
    primaryMuted:    'rgba(99, 102, 241, 0.12)',
    primaryGlow:     'rgba(99, 102, 241, 0.20)',
    primarySubtle:   'rgba(99, 102, 241, 0.08)',
    primaryLight:    'rgba(99, 102, 241, 0.10)',
    primaryBadge:    'rgba(99, 102, 241, 0.16)',
    primaryDisabled: 'rgba(99, 102, 241, 0.15)',
    primaryBorder:   'rgba(99, 102, 241, 0.25)',
  },
  success: {
    DEFAULT: '#10B981',
    hover:   '#34D399',
    press:   '#059669',
    muted:   'rgba(16, 185, 129, 0.12)',
    glow:    'rgba(16, 185, 129, 0.20)',
    light:   'rgba(16, 185, 129, 0.08)',
    dim:     'rgba(16, 185, 129, 0.05)',
    border:  'rgba(16, 185, 129, 0.30)',
  },
  warning: {
    DEFAULT: '#F59E0B',
    hover:   '#FBBF24',
    press:   '#D97706',
    muted:   'rgba(245, 158, 11, 0.12)',
    glow:    'rgba(245, 158, 11, 0.20)',
    dim:     'rgba(245, 158, 11, 0.05)',
    banner:  'rgba(245, 158, 11, 0.07)',
    badge:   'rgba(245, 158, 11, 0.16)',
    border:  'rgba(245, 158, 11, 0.30)',
  },
  danger: {
    DEFAULT: '#EF4444',
    hover:   '#F87171',
    press:   '#DC2626',
    muted:   'rgba(239, 68, 68, 0.12)',
    glow:    'rgba(239, 68, 68, 0.20)',
    badge:   'rgba(239, 68, 68, 0.16)',
  },
  info: {
    DEFAULT: '#3B82F6',
    border:  'rgba(59, 130, 246, 0.30)',
    bg:      'rgba(59, 130, 246, 0.06)',
  },
  category: {
    food:     '#F97316',
    drinks:   '#3B82F6',
    desserts: '#EC4899',
    specials: '#8B5CF6',
    default:  '#64748B',
  },
  status: {
    available:        '#10B981',
    availableMuted:   'rgba(16, 185, 129, 0.12)',
    occupied:         '#EF4444',
    occupiedMuted:    'rgba(239, 68, 68, 0.12)',
    reserved:         '#F59E0B',
    reservedMuted:    'rgba(245, 158, 11, 0.12)',
    maintenance:      '#6B7280',
    maintenanceMuted: 'rgba(107, 114, 128, 0.12)',
  },
  shadows: {
    small:  'rgba(0, 0, 0, 0.06)',
    medium: 'rgba(0, 0, 0, 0.10)',
    large:  'rgba(0, 0, 0, 0.18)',
    glow:   'rgba(99, 102, 241, 0.12)',
  },
} as const;

/** Payment method accent colors */
export const PaymentColors = {
  cash:         ThemeColors.success.DEFAULT,
  qris:         ThemeColors.accent.primary,
  debit:        ThemeColors.info.DEFAULT,
  credit:       ThemeColors.warning.DEFAULT,
  eWallet:      ThemeColors.category.desserts,
  bankTransfer: ThemeColors.category.specials,
} as const;

/** Brand colors (theme-independent) */
export const Brand = {
  primary: '#6366F1',
  primaryHover: '#818CF8',
  primaryPress: '#4F46E5',
} as const;

/** Spacing tokens */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

/** Border radius tokens */
export const BorderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

/** Shadow presets for consistent elevation */
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: ThemeColors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 0,
  },
} as const;
