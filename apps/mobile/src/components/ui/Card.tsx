import { View, StyleSheet, type ViewProps, Platform } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/tokens';

type CardProps = ViewProps & {
  elevated?: boolean;
};

export function Card({ elevated, style, children, ...rest }: CardProps) {
  const { colors, isDark } = useTheme();
  const bg = elevated ? colors.surfaceElevated : colors.surface;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: colors.border },
        !isDark && styles.cardLight,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
  },
  cardLight: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    default: {},
  }),
});
