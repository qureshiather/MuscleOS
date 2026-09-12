import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/tokens';

type SectionHeaderProps = {
  title: string;
  /** Short line explaining why the section contains what it contains. */
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, caption, actionLabel, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[typography.sectionTitle, { color: colors.text, flex: 1, minWidth: 0 }]}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[typography.label, { color: colors.primary }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {caption ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs / 2,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
