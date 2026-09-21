import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';

type ListRowProps = {
  title: string;
  hint?: string;
  onPress: () => void;
  /** Sit inside a Card: no outer chrome, hairline divider. */
  inset?: boolean;
  /** Hide the bottom hairline when `inset`. */
  last?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  testID?: string;
};

export function ListRow({
  title,
  hint,
  onPress,
  inset = false,
  last = false,
  destructive = false,
  disabled = false,
  showChevron = true,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const titleColor = destructive ? colors.danger : colors.text;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        inset ? styles.insetRow : styles.row,
        inset
          ? {
              borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.textBlock}>
        <Text style={[typography.bodyMedium, { color: titleColor }]}>{title}</Text>
        {hint ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{hint}</Text>
        ) : null}
      </View>
      {showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    minHeight: touch.min,
  },
  insetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    minHeight: touch.min,
  },
  textBlock: { flex: 1, minWidth: 0, marginRight: spacing.sm },
});
