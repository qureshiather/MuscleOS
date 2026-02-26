import React, { createContext, useContext, useMemo, useState } from 'react';

export const colors = {
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

type ThemeContextValue = {
  colors: typeof colors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark] = useState(true);
  const value = useMemo(
    () => ({ colors, isDark }),
    [isDark]
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
