import { Pressable, Text, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { fontScaleCap } from '@/theme/layout';

type PrimaryButtonProps = PressableProps & {
  label: string;
  variant?: 'filled' | 'outline';
};

export function PrimaryButton({ label, variant = 'filled', style, disabled, ...rest }: PrimaryButtonProps) {
  const { colors } = useTheme();
  const isFilled = variant === 'filled';

  return (
    <Pressable
      style={(state) => [
        styles.btn,
        isFilled
          ? { backgroundColor: colors.primary, opacity: disabled ? 0.5 : state.pressed ? 0.9 : 1 }
          : { borderColor: colors.border, opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1 },
        !isFilled && styles.outline,
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={disabled}
      {...rest}
    >
      <Text
        style={[typography.button, styles.label, { color: isFilled ? colors.primaryOn : colors.text }]}
        maxFontSizeMultiplier={fontScaleCap.chrome}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: touch.min,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  label: { textAlign: 'center' },
});
