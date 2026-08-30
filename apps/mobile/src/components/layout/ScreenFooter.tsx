import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useBottomSpace, useScreenGutter } from '@/theme/layout';
import { spacing } from '@/theme/tokens';

type ScreenFooterProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Pinned footer that sits above the Android nav bar / iOS home indicator. */
export function ScreenFooter({ children, style }: ScreenFooterProps) {
  const { colors } = useTheme();
  const gutter = useScreenGutter();
  const paddingBottom = useBottomSpace(spacing.lg);

  return (
    <View
      style={[
        styles.footer,
        {
          paddingHorizontal: gutter,
          paddingBottom,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
