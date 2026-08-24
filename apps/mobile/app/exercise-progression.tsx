import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useSessionsStore } from '@/store/sessionsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatWeight } from '@/utils/weightUnits';
import {
  buildExercisePRs,
  type ExercisePR,
  type SetWithDate,
} from '@/utils/oneRepMax';
import {
  compareToStrengthStandards,
  STRENGTH_LEVEL_LABELS,
  type StrengthLevel,
} from '@/data/strengthStandards';

const CHART_HEIGHT = 180;
const CHART_PADDING = 24;

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProgressionChart({
  history,
  max1RM,
  colors,
}: {
  history: SetWithDate[];
  max1RM: number;
  colors: Record<string, string>;
}) {
  const points = [...history].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  if (points.length === 0) return null;

  const width = Dimensions.get('window').width - CHART_PADDING * 2 - 40;
  const barWidth = Math.max(12, (width - (points.length - 1) * 6) / points.length);

  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {points.map((p, i) => {
          const ratio = max1RM > 0 ? Math.min(1, p.estimated1RM / max1RM) : 0;
          const barH = Math.max(4, ratio * (CHART_HEIGHT - 24));
          return (
            <View key={`${p.completedAt}-${i}`} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barH,
                    backgroundColor: colors.primary,
                    alignSelf: 'flex-end',
                  },
                ]}
              />
              <Text
                style={[styles.barLabel, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {formatChartDate(p.completedAt)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          Est. 1RM over time
        </Text>
      </View>
    </View>
  );
}

function StrengthStandardBar({
  comparison,
  weightUnit,
  colors,
}: {
  comparison: { level: StrengthLevel; nextLevel1RMKg: number | null; nextLevelName: string | null; hasStandards: boolean };
  weightUnit: 'kg' | 'lb';
  colors: Record<string, string>;
}) {
  if (!comparison.hasStandards) return null;
  const { level, nextLevel1RMKg, nextLevelName } = comparison;
  return (
    <View style={[styles.standardCard, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.standardTitle, { color: colors.text }]}>
        Strength level: {STRENGTH_LEVEL_LABELS[level]}
      </Text>
      {nextLevelName && nextLevel1RMKg != null && (
        <Text style={[styles.standardHint, { color: colors.textMuted }]}>
          Next ({nextLevelName}): {formatWeight(nextLevel1RMKg, weightUnit)}
        </Text>
      )}
    </View>
  );
}

export default function ExerciseProgressionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId?: string }>();
  const exerciseId = params.exerciseId ?? '';

  const loadSessions = useSessionsStore((s) => s.load);
  const completedSessions = useSessionsStore((s) => s.completedSessions);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const profile = useSettingsStore((s) => s.profile);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const allPRs = buildExercisePRs(completed);
  const pr = allPRs.find((p) => p.exerciseId === exerciseId);
  const exerciseName = getExercise(exerciseId)?.name ?? exerciseId;

  const comparison =
    pr &&
    profile.weightKg != null &&
    profile.weightKg > 0 &&
    profile.sex
      ? compareToStrengthStandards(
          exerciseId,
          pr.bestEstimated1RM,
          profile.weightKg,
          profile.sex
        )
      : null;

  if (!exerciseId || !pr) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScreenHeader title="Exercise" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            No progression data for this exercise.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title={exerciseName}
        subtitle="Progression & 1RM history"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <Text style={[typography.caption, styles.cardLabel, { color: colors.textMuted }]}>
            Best est. 1RM
          </Text>
          <Text style={[typography.dataLarge, { color: colors.primary }]}>
            {formatWeight(pr.bestEstimated1RM, weightUnit)}
          </Text>
          {pr.bestSet && (
            <Text style={[typography.data, styles.bestSetText, { color: colors.textSecondary }]}>
              Best set: {formatWeight(pr.bestSet.weightKg, weightUnit)} × {pr.bestSet.reps}
            </Text>
          )}
        </Card>

        {comparison && (
          <StrengthStandardBar
            comparison={comparison}
            weightUnit={weightUnit}
            colors={colors}
          />
        )}

        {pr.history.length > 0 && (
          <>
            <Text style={[typography.sectionTitle, styles.sectionTitle, { color: colors.text }]}>
              Est. 1RM over time
            </Text>
            <ProgressionChart
              history={pr.history}
              max1RM={pr.bestEstimated1RM}
              colors={colors}
            />
          </>
        )}

        <View style={styles.historySection}>
          <Text style={[typography.sectionTitle, styles.sectionTitle, { color: colors.text }]}>
            All recorded sets
          </Text>
          {[...pr.history].map((p, i) => (
            <View
              key={`${p.completedAt}-${i}`}
              style={[styles.historyRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[typography.caption, styles.historyDate, { color: colors.textSecondary }]}>
                {formatChartDate(p.completedAt)}
              </Text>
              <Text style={[typography.data, styles.historySet, { color: colors.text }]}>
                {formatWeight(p.weightKg, weightUnit)} × {p.reps}
              </Text>
              <Text style={[typography.data, styles.history1RM, { color: colors.primary }]}>
                ~{formatWeight(p.estimated1RM, weightUnit)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  scroll: { padding: spacing.lg + 4, paddingBottom: 40 },
  card: {
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  bestSetText: { marginTop: spacing.sm - 2 },
  standardCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  standardTitle: { fontSize: 16, fontFamily: typography.bodyMedium.fontFamily },
  standardHint: { fontSize: 13, marginTop: 4, fontFamily: typography.data.fontFamily },
  sectionTitle: { marginBottom: spacing.md },
  chartContainer: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: 'center', minWidth: 0 },
  bar: {
    width: '80%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: { fontSize: 9, marginTop: 4, fontFamily: typography.caption.fontFamily },
  chartLegend: { marginTop: spacing.sm },
  legendText: { fontSize: 11, fontFamily: typography.caption.fontFamily },
  historySection: { marginTop: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  historyDate: { width: 80 },
  historySet: { flex: 1 },
  history1RM: {},
});
