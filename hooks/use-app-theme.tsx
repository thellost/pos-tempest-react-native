import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ColorScheme = 'dark' | 'light';

const STORAGE_KEY = '@pos_tempest/color_scheme';

// ── CSS variable bundles for each theme ───────────────────────────────────────

const darkVars = vars({
  '--color-price':            '#FBBF24',
  '--color-surface':          '#0C0F14',
  '--color-surface-soft':     '#141820',
  '--color-surface-card':     '#1A1F2C',
  '--color-surface-raised':   '#222838',
  '--color-surface-elevated': '#2A3142',
  '--color-border':           'rgba(255, 255, 255, 0.06)',
  '--color-border-subtle':    'rgba(255, 255, 255, 0.04)',
  '--color-border-strong':    'rgba(255, 255, 255, 0.12)',
  '--color-text':             '#F8FAFC',
  '--color-text-strong':      '#FFFFFF',
  '--color-text-secondary':   '#E2E8F0',
  '--color-text-muted':       '#94A3B8',
  '--color-text-faint':       '#64748B',
});

const lightVars = vars({
  '--color-price':            '#B45309',
  '--color-surface':          '#F8FAFC',
  '--color-surface-soft':     '#FFFFFF',
  '--color-surface-card':     '#FFFFFF',
  '--color-surface-raised':   '#F1F5F9',
  '--color-surface-elevated': '#E2E8F0',
  '--color-border':           'rgba(0, 0, 0, 0.08)',
  '--color-border-subtle':    'rgba(0, 0, 0, 0.05)',
  '--color-border-strong':    'rgba(0, 0, 0, 0.15)',
  '--color-text':             '#0F172A',
  '--color-text-strong':      '#000000',
  '--color-text-secondary':   '#1E293B',
  '--color-text-muted':       '#475569',
  '--color-text-faint':       '#94A3B8',
});

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  colorScheme: ColorScheme;
  themeVars: ReturnType<typeof vars>;
  isDark: boolean;
  isThemeChanging: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('light');
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const changingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setColorSchemeState(stored);
      }
    });
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    if (changingTimerRef.current) clearTimeout(changingTimerRef.current);
    // Show spinner first, then change theme in the next frame so the
    // spinner gets a chance to paint before the heavy re-render begins.
    setIsThemeChanging(true);
    setTimeout(() => {
      setColorSchemeState(scheme);
      AsyncStorage.setItem(STORAGE_KEY, scheme);
      changingTimerRef.current = setTimeout(() => {
        setIsThemeChanging(false);
      }, 800);
    }, 50);
  }, []);

  const toggleColorScheme = useCallback(() => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  }, [colorScheme, setColorScheme]);

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        themeVars: colorScheme === 'dark' ? darkVars : lightVars,
        isDark: colorScheme === 'dark',
        isThemeChanging,
        setColorScheme,
        toggleColorScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return ctx;
}
