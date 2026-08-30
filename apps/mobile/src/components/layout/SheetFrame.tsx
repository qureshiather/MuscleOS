import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useBottomSpace, useModalMaxHeight } from '@/theme/layout';
import { radius, spacing } from '@/theme/tokens';

type SheetFrameProps = ViewProps;

/** Bottom-sheet chrome: rounded top, max-height from the window, inset-aware padding. */
export function SheetFrame({ children, style, ...rest }: SheetFrameProps) {
  const { colors } = useTheme();
  const paddingBottom = useBottomSpace(spacing.xl);
  const maxHeight = useModalMaxHeight();

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          paddingBottom,
          maxHeight,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    width: '100%',
  },
});
