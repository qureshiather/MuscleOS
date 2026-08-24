import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'muscleos_theme';

export type ThemePreference = 'auto' | 'dark' | 'light';

const darkColors = {
  background: '#0E0E0F',
  surface: '#18181A',
  surfaceElevated: '#222224',
  border: '#2E2E30',
  text: '#F2F2F0',
  textSecondary: '#A8A8A4',
  textMuted: '#6B6B67',
  primary: '#C45C26',
  primaryDim: '#A34A1E',
  accent: '#5B8DEF',
  danger: '#D93B3B',
  warning: '#D4A017',
  muscleHighlight: '#3D9B5F',
  muscleRecovering: '#D4A017',
  recoveryHot: '#D93B3B',
  recoveryWarm: '#D4A017',
  recoveryReady: '#3D9B5F',
  bodyDiagramBorder: '#4A4A4E',
  bodyDiagramFill: '#5C5C60',
} as const;

const lightColors = {
  background: '#F5F4F2',
  surface: '#FFFFFF',
  surfaceElevated: '#EEEDEA',
  border: '#DDDBD6',
  text: '#1A1A18',
  textSecondary: '#4A4A46',
  textMuted: '#6B6B67',
  primary: '#B8521F',
  primaryDim: '#9A4519',
  accent: '#3D6FD4',
  danger: '#C53030',
  warning: '#B8890F',
  muscleHighlight: '#2D8A4E',
  muscleRecovering: '#B8890F',
  recoveryHot: '#C53030',
  recoveryWarm: '#B8890F',
  recoveryReady: '#2D8A4E',
  bodyDiagramBorder: '#B8B6B0',
  bodyDiagramFill: '#C8C6C0',
} as const;

export const colors = darkColors;
export type ThemeColors = typeof darkColors | typeof lightColors;

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

/** Recovery heat-map palette for MuscleDiagram (intensity index → color). */
export function getRecoveryPalette(colors: ThemeColors, threeStates: boolean): string[] {
  if (threeStates) {
    return [colors.recoveryHot, colors.recoveryWarm, colors.recoveryReady];
  }
  return [colors.recoveryWarm, colors.recoveryReady];
}
