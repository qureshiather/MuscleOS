import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { fontScaleCap } from '@/theme/layout';
import { formatE1RM } from '@/utils/oneRepMax';
import {
  formatProgressGain,
  PROGRESS_DELTA_DAYS,
  type ProgressHighlight,
} from '@/utils/personalRecords';
import type { WeightUnit } from '@/utils/weightUnits';

/**
 * History tab: your most-trained lifts as a sideways strip — best e1RM, a bar per recent session
 * and the 30-day gain. A card opens that lift's progression chart; See all opens Personal Records.
 * Spec: docs/features/history-analytics.md#progress-strip
 */
export function ProgressStrip({
  highlights,
  exerciseName,
  weightUnit,
  onOpenLift,
  onSeeAll,
}: {
  highlights: readonly ProgressHighlight[];
  exerciseName: (exerciseId: string) => string;
  weightUnit: WeightUnit;
  onOpenLift: (exerciseId: string) => void;
  onSeeAll: () => void;
}) {
  const { colors } = useTheme();
  if (highlights.length === 0) return null;

  return (
    <View style={styles.section} testID="progress-strip">
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Progress</Text>
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" testID="progress-see-all">
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {highlights.map((h) => {
          const name = exerciseName(h.exerciseId);
          const best = formatE1RM(h.bestEstimated1RM, weightUnit);
          const gain = formatProgressGain(h.gainKg, weightUnit);
          return (
            <Pressable
              key={h.exerciseId}
              onPress={() => onOpenLift(h.exerciseId)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${name}, estimated 1RM ${best}${gain ? `, ${gain} in ${PROGRESS_DELTA_DAYS} days` : ''}`}
              testID={`progress-lift-${h.exerciseId}`}
            >
              <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Text
                style={[styles.best, { color: colors.text }]}
                maxFontSizeMultiplier={fontScaleCap.tabular}
                numberOfLines={1}
              >
                {best}
              </Text>
              <Text style={[styles.caption, { color: colors.textMuted }]}>Est. 1RM</Text>
              <View style={styles.spark}>
                {h.spark.map((ratio, i) => (
                  <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: one bar per session, in order
                    key={i}
                    style={[styles.sparkTrack, { backgroundColor: colors.surfaceElevated }]}
                  >
                    <View style={{ flex: Math.max(0, 1 - ratio) }} />
                    <View style={[styles.sparkFill, { flex: ratio || 0.01, backgroundColor: colors.primary }]} />
                  </View>
                ))}
              </View>
              <View style={styles.footer}>
                {gain ? (
                  <>
                    <Ionicons name="trending-up" size={14} color={colors.success} />
                    <Text style={[styles.caption, { color: colors.success }]} numberOfLines={1}>
                      {gain} · {PROGRESS_DELTA_DAYS}d
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {h.sessionCount} sessions
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  label: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  seeAll: { ...typography.caption, fontFamily: typography.label.fontFamily },
  row: { gap: spacing.sm },
  card: {
    width: 148,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },
  best: { ...typography.sectionTitle, fontFamily: typography.data.fontFamily, marginTop: spacing.xs },
  caption: { ...typography.caption },
  spark: { flexDirection: 'row', gap: 3, height: 28, marginTop: spacing.sm },
  sparkTrack: { flex: 1, borderRadius: 3, overflow: 'hidden' },
  sparkFill: { minHeight: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
});
