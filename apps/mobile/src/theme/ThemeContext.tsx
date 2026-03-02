import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'muscleos_theme';

export type ThemePreference = 'auto' | 'dark' | 'light';

const darkColors = {
  background: '#0a0a0b',
  surface: '#141416',
  surfaceElevated: '#1c1c1f',
  border: '#2a2a2e',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  primary: '#22c55e',
  primaryDim: '#16a34a',
  accent: '#3b82f6',
  danger: '#ef4444',
  warning: '#f59e0b',
  muscleHighlight: '#22c55e',
  muscleRecovering: '#f59e0b',
} as const;

const lightColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#16a34a',
  primaryDim: '#15803d',
  accent: '#2563eb',
  danger: '#dc2626',
  warning: '#d97706',
  muscleHighlight: '#ea580c',
  muscleRecovering: '#d97706',
} as const;

export const colors = darkColors;
export type ThemeColors = typeof darkColors;

type ThemeContextValue = {
  colors: typeof darkColors | typeof lightColors;
  isDark: boolean;
  themePreference: ThemePreference;
  setTheme: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('auto');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'auto') {
        setThemePreference(v);
      }
    });
  }, []);

  const setTheme = async (preference: ThemePreference) => {
    setThemePreference(preference);
    await AsyncStorage.setItem(THEME_KEY, preference);
  };

  const isDark =
    themePreference === 'dark' ? true : themePreference === 'light' ? false : (deviceScheme ?? 'light') === 'dark';
  const themeColors = isDark ? darkColors : lightColors;
  const value = useMemo(
    () => ({ colors: themeColors, isDark, themePreference, setTheme }),
    [isDark, themePreference]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
