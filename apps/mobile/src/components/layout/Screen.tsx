import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';

/**
 * How the screen meets the device chrome.
 *
 * - `tab` — tab screens. Top inset only; the tab bar owns the bottom.
 * - `stack` — full-screen routes. Top and bottom insets.
 * - `chrome` — top inset only. A pinned footer / sheet owns the bottom via
 *   `ScreenFooter` or `SheetFrame`.
 */
export type ScreenKind = 'tab' | 'stack' | 'chrome';

const EDGES: Record<ScreenKind, readonly Edge[]> = {
  tab: ['top'],
  stack: ['top', 'bottom'],
  chrome: ['top'],
};

type ScreenProps = {
  children: ReactNode;
  kind?: ScreenKind;
  style?: StyleProp<ViewStyle>;
};

/** Presentation shell. Screens should not import SafeAreaView themselves. */
export function Screen({ children, kind = 'stack', style }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: colors.background }, style]}
      edges={EDGES[kind]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
