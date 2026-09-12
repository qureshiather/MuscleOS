import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing, touch } from '@/theme/tokens';
import { getTrainingRegion, regionColor, topMuscleLabels } from '@/utils/trainingRegion';
import { MuscleLoadBar } from './MuscleLoadBar';
import type { MuscleId, WorkoutTemplate } from '@muscleos/types';

type TemplateCardProps = {
  template: WorkoutTemplate;
  /** Worked muscles with duplicates kept — drives the load bar and identity line. */
  muscleIds: readonly MuscleId[];
  lastDone?: string | null;
  onPress: (template: WorkoutTemplate) => void;
  onMenu?: (template: WorkoutTemplate) => void;
  dimmed?: boolean;
  /** Custom template on a Basic account: visible, but starting it requires Pro. */
  locked?: boolean;
};

export function TemplateCard({
  template,
  muscleIds,
  lastDone,
  onPress,
  onMenu,
  dimmed,
  locked,
}: TemplateCardProps) {
  const { colors, isDark } = useTheme();
  const accent = regionColor(getTrainingRegion(muscleIds), colors);
  const muscleLine = topMuscleLabels(muscleIds).join(' · ');
  const description = template.description?.trim();
  const exerciseCount = template.exerciseIds.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${template.name}, ${exerciseCount} exercises, requires Pro`
          : `${template.name}, ${exerciseCount} exercises`
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark && styles.cardLight,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(template)}
    >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[typography.bodyMedium, styles.name, { color: colors.text }]} numberOfLines={2}>
            {template.name}
          </Text>
          {locked ? <Ionicons name="lock-closed" size={13} color={colors.textMuted} /> : null}
          {onMenu ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Options for ${template.name}`}
              hitSlop={touch.hitSlop}
              style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
              onPress={() => onMenu(template)}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {muscleLine ? (
          <Text
            style={[styles.muscleLine, { color: locked ? colors.textMuted : accent }]}
            numberOfLines={1}
          >
            {muscleLine.toUpperCase()}
          </Text>
        ) : null}

        {description ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {locked ? (
            <View style={[styles.chip, { backgroundColor: colors.primarySurface }]}>
              <Text style={[styles.proText, { color: colors.primary }]}>PRO</Text>
            </View>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
            {[`${exerciseCount} ex`, lastDone].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
      </View>

      <MuscleLoadBar muscleIds={muscleIds} muted={locked} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md - 2,
    paddingBottom: spacing.md,
    gap: spacing.xs / 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: { flex: 1, minWidth: 0 },
  menuBtn: { padding: spacing.xs / 2 },
  muscleLine: {
    fontFamily: typography.label.fontFamily,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 1,
  },
  proText: {
    fontFamily: typography.data.fontFamily,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  metaText: {
    fontFamily: typography.data.fontFamily,
    fontSize: 11,
    lineHeight: 16,
  },
  dimmed: { opacity: 0.7 },
  pressed: { opacity: 0.85 },
});
