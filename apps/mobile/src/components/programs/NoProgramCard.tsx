import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';

type NoProgramCardProps = {
  /** No program is chosen: the card is marked and offers its two ways to train. */
  selected: boolean;
  onSelect: () => void;
  onBuildTemplate: () => void;
  onStartEmpty: () => void;
};

/** The Programs list's "No program" choice: your own templates, or just start lifting. */
export function NoProgramCard({ selected, onSelect, onBuildTemplate, onStartEmpty }: NoProgramCardProps) {
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
        {selected
          ? 'Great. Make your own templates, or just start a workout and add exercises as you go.'
          : 'Skip the plan. Train from your own templates, or start empty and add exercises as you go.'}
      </Text>
      {selected ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onBuildTemplate}
            style={({ pressed }) => [
              styles.action,
              { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Build a template</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onStartEmpty}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="barbell-outline" size={16} color={colors.primaryOn} />
            <Text style={[styles.actionText, { color: colors.primaryOn }]}>Start empty workout</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md + 2, gap: spacing.xs + 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, minWidth: 0 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontFamily: fontFamily.sansSemiBold, fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  action: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  actionText: { fontFamily: fontFamily.sansSemiBold, fontSize: 14 },
});
