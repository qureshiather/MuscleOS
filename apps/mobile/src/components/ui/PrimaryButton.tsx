import { Pressable, Text, StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { fontScaleCap } from '@/theme/layout';

type PrimaryButtonProps = PressableProps & {
  label: string;
  variant?: 'filled' | 'outline' | 'danger';
};

export function PrimaryButton({ label, variant = 'filled', style, disabled, ...rest }: PrimaryButtonProps) {
  const { colors } = useTheme();
  const isOutline = variant === 'outline';
  const backgroundColor = variant === 'danger' ? colors.danger : variant === 'filled' ? colors.primary : 'transparent';
  const labelColor = isOutline ? colors.text : colors.primaryOn;

  return (
    <Pressable
      style={(state) => [
        styles.btn,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : state.pressed ? (isOutline ? 0.85 : 0.9) : 1,
        },
        isOutline && [styles.outline, { borderColor: colors.border }],
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={disabled}
      {...rest}
    >
      <Text
        style={[typography.button, styles.label, { color: labelColor }]}
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
