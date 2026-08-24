import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  darkThemeColors,
  lightThemeColors,
  type ThemeColors,
} from './palette';

export type { ThemeColors } from './palette';
export { brandColors, paletteConfig, withAlpha } from './palette';

const THEME_KEY = 'muscleos_theme';

export type ThemePreference = 'auto' | 'dark' | 'light';

/** @deprecated Use `darkThemeColors` from `@/theme/palette` or `useTheme().colors`. */
export const colors = darkThemeColors;

type ThemeContextValue = {
  colors: ThemeColors;
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
  const themeColors = isDark ? darkThemeColors : lightThemeColors;
  const value = useMemo(
    () => ({ colors: themeColors, isDark, themePreference, setTheme }),
    [isDark, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
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
