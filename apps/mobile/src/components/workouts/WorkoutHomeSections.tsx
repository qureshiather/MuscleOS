import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useDeviceMetrics } from '@/theme/layout';
import { getTrainingRegion, regionColor, topMuscleLabels } from '@/utils/trainingRegion';
import { MuscleLoadBar } from './MuscleLoadBar';
import { TemplateCard } from './TemplateCard';
import type { MuscleId, WorkoutTemplate, WorkoutSession } from '@muscleos/types';

/** Worked muscles per template id, duplicates kept, keyed for O(1) card lookups. */
export type MusclesByTemplate = Record<string, MuscleId[]>;

const NO_MUSCLES: MuscleId[] = [];

type RecentWorkoutsRowProps = {
  items: { session: WorkoutSession; template: WorkoutTemplate }[];
  musclesByTemplate: MusclesByTemplate;
  onPress: (template: WorkoutTemplate) => void;
  formatRelative: (iso: string) => string;
};

export function RecentWorkoutsRow({
  items,
  musclesByTemplate,
  onPress,
  formatRelative,
}: RecentWorkoutsRowProps) {
  const { colors, isDark } = useTheme();
  const { isNarrow } = useDeviceMetrics();
  const cardWidth = isNarrow ? 140 : 160;

  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {items.map(({ session, template }) => {
        const muscleIds = musclesByTemplate[template.id] ?? NO_MUSCLES;
        const accent = regionColor(getTrainingRegion(muscleIds), colors);
        const completedAgo = session.completedAt ? formatRelative(session.completedAt) : null;
        const muscleLine = topMuscleLabels(muscleIds, 2).join(' · ');
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={`${template.name}, ${template.exerciseIds.length} exercises`}
            style={({ pressed }) => [
              styles.card,
              {
                width: cardWidth,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
              !isDark && styles.cardLight,
            ]}
            onPress={() => onPress(template)}
          >
            <View style={styles.cardBody}>
              <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={2}>
                {template.name}
              </Text>
              {muscleLine ? (
                <Text style={[styles.muscleLine, { color: accent }]} numberOfLines={1}>
                  {muscleLine.toUpperCase()}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                  {[`${template.exerciseIds.length} ex`, completedAgo].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
            </View>
            <MuscleLoadBar muscleIds={muscleIds} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type SuggestedWorkoutsGridProps = {
  items: { template: WorkoutTemplate }[];
  musclesByTemplate: MusclesByTemplate;
  onPress: (template: WorkoutTemplate) => void;
};

export function SuggestedWorkoutsGrid({
  items,
  musclesByTemplate,
  onPress,
}: SuggestedWorkoutsGridProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.grid}>
      {items.map(({ template }) => (
        <View key={template.id} style={styles.gridCell}>
          <TemplateCard
            template={template}
            muscleIds={musclesByTemplate[template.id] ?? NO_MUSCLES}
            onPress={onPress}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 96,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
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
    marginTop: 'auto',
    paddingTop: spacing.xs,
  },
  metaText: {
    fontFamily: typography.data.fontFamily,
    fontSize: 11,
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCell: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
  },
});
