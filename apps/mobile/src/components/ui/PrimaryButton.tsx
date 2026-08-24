import { Pressable, Text, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

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
      <Text style={[typography.button, { color: isFilled ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  outline: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
