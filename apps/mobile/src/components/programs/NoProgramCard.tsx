import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

type NoProgramCardProps = {
  /** No program is chosen: the card is marked. */
  selected: boolean;
  onSelect: () => void;
};

/** The Programs list's "No program" choice: train from your own templates. */
export function NoProgramCard({ selected, onSelect }: NoProgramCardProps) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? 'No program, selected' : 'No program'}
      accessibilityState={{ selected }}
      testID="program-card-none"
      disabled={selected}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primaryBorder : isDark ? colors.surface : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.top}>
        <Text style={[typography.bodyMedium, styles.name, { color: colors.text }]}>No program</Text>
        {selected ? (
          <View style={styles.tag}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[styles.tagText, { color: colors.success }]}>Selected</Text>
          </View>
        ) : null}
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        Skip the plan and train from your own templates.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md + 2, gap: spacing.xs + 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, minWidth: 0 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontFamily: fontFamily.sansSemiBold, fontSize: 11 },
});
