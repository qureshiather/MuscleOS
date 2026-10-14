import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { fontFamily, typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import type { BuiltInProgram } from '@/data/builtInTemplates';
import { programMeta } from '@/utils/programs';

type ProgramCardProps = {
  program: BuiltInProgram;
  active?: boolean;
  /** Name and meta only, for the first-run grid. */
  compact?: boolean;
  onPress: (program: BuiltInProgram) => void;
};

export function ProgramCard({ program, active, compact, onPress }: ProgramCardProps) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? `${program.name}, in your workouts` : program.name}
      testID={`program-card-${program.id}`}
      onPress={() => onPress(program)}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        {
          backgroundColor: colors.surface,
          borderColor: active ? colors.primaryBorder : isDark ? colors.surface : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.top}>
        <Text style={[typography.bodyMedium, styles.name, { color: colors.text }]} numberOfLines={2}>
          {program.name}
        </Text>
        {active ? (
          <View style={styles.activeTag}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            {!compact && (
              <Text style={[styles.tagText, { color: colors.success }]}>In your workouts</Text>
            )}
          </View>
        ) : !compact ? (
          <View style={[styles.levelTag, { borderColor: colors.border }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>{program.level}</Text>
          </View>
        ) : null}
      </View>
      {!compact && (
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{program.summary}</Text>
      )}
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {compact ? `${program.daysPerWeek} days/wk · ${program.level}` : programMeta(program)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md + 2,
    gap: spacing.xs + 2,
  },
  compact: { flex: 1, padding: spacing.md, minHeight: 76 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, minWidth: 0 },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tagText: { fontFamily: fontFamily.sansSemiBold, fontSize: 11 },
  meta: { fontFamily: fontFamily.sansMedium, fontSize: 12 },
});
