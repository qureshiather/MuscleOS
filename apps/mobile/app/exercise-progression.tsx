import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useTextScaledSize } from '@/theme/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { completedNewestFirst, useSessionsStore } from '@/store/sessionsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatWeight } from '@/utils/weightUnits';
import { buildExercisePRs, formatE1RM } from '@/utils/oneRepMax';
import {
  type ProgressPoint,
  progressionPoints,
  type StrengthSummary,
  strengthSummary,
} from '@/utils/personalRecords';

const CHART_HEIGHT = 180;

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProgressionChart({
  points,
  colors,
  weightUnit,
}: {
  points: ProgressPoint[];
  colors: Record<string, string>;
  weightUnit: 'kg' | 'lb';
}) {
  const chartHeight = useTextScaledSize(CHART_HEIGHT);
  if (points.length === 0) return null;
  const firstDate = formatChartDate(points[0].completedAt);
  const lastDate = formatChartDate(points[points.length - 1].completedAt);

  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.chart, { height: chartHeight }]}>
        {points.map((p, i) => {
          const barH = Math.max(4, p.ratio * (chartHeight - 24));
          return (
            <View
              key={`${p.completedAt}-${i}`}
              testID="progression-bar"
              accessibilityLabel={`${formatChartDate(p.completedAt)}, ${formatE1RM(p.estimated1RM, weightUnit)}`}
              style={styles.barColumn}
            >
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
            </View>
          );
        })}
      </View>
      {/* One axis for the whole range: a date under every bar can't fit once there are more than a few. */}
      <View style={styles.chartAxis}>
        <Text style={[styles.axisLabel, { color: colors.textMuted }]} testID="progression-axis-start">
          {firstDate}
        </Text>
        {lastDate !== firstDate ? (
          <Text style={[styles.axisLabel, { color: colors.textMuted }]} testID="progression-axis-end">
            {lastDate}
          </Text>
        ) : null}
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
  strength,
  weightUnit,
  colors,
}: {
  strength: StrengthSummary;
  weightUnit: 'kg' | 'lb';
  colors: Record<string, string>;
}) {
  return (
    <View style={[styles.standardCard, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.standardTitle, { color: colors.text }]}>Strength level: {strength.label}</Text>
      {strength.next && (
        <Text style={[styles.standardHint, { color: colors.textMuted }]}>
          Next ({strength.next.label}): {formatE1RM(strength.next.oneRepMaxKg, weightUnit)}
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
  // Subscribe to `sessions` (not the stable `completedSessions` getter) so the screen re-renders
  // once its focus load lands.
  const sessions = useSessionsStore((s) => s.sessions);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const profile = useSettingsStore((s) => s.profile);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedNewestFirst(sessions);
  // Canonical ids: an alias in the link or in old sessions resolves to the current exercise.
  const canonicalId = (id: string) => getExercise(id)?.id ?? id;
  const allPRs = buildExercisePRs(completed, canonicalId);
  const pr = allPRs.find((p) => p.exerciseId === canonicalId(exerciseId));
  const exerciseName = getExercise(exerciseId)?.name ?? exerciseId;
  const strength = pr ? strengthSummary(pr.exerciseId, pr.bestEstimated1RM, profile) : null;


  if (!exerciseId || !pr) {
    return (
      <Screen>
        <ScreenHeader title="Exercise" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            No progression data for this exercise.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
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
            {formatE1RM(pr.bestEstimated1RM, weightUnit)}
          </Text>
          {pr.bestSet && (
            <Text style={[typography.data, styles.bestSetText, { color: colors.textSecondary }]}>
              Best set: {formatWeight(pr.bestSet.weightKg, weightUnit)} × {pr.bestSet.reps}
            </Text>
          )}
        </Card>

        {strength && <StrengthStandardBar strength={strength} weightUnit={weightUnit} colors={colors} />}

        {pr.history.length > 0 && (
          <>
            <Text style={[typography.sectionTitle, styles.sectionTitle, { color: colors.text }]}>
              Est. 1RM over time
            </Text>
            <ProgressionChart
              points={progressionPoints(pr.history, pr.bestEstimated1RM)}
              colors={colors}
              weightUnit={weightUnit}
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
              testID="progression-set"
              style={[styles.historyRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[typography.caption, styles.historyDate, { color: colors.textSecondary }]}>
                {formatChartDate(p.completedAt)}
              </Text>
              <Text style={[typography.data, styles.historySet, { color: colors.text }]}>
                {formatWeight(p.weightKg, weightUnit)} × {p.reps}
              </Text>
              <Text style={[typography.data, styles.history1RM, { color: colors.primary }]}>
                ~{formatE1RM(p.estimated1RM, weightUnit)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
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
  // No fixed gap: each bar takes an equal share and its width leaves the space, so a long
  // history narrows the bars instead of overflowing the chart.
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barColumn: { flex: 1, alignItems: 'center', minWidth: 0 },
  bar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 4,
  },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 11, fontFamily: typography.caption.fontFamily },
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
