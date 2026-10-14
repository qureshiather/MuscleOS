import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
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
import { formatWeight, kgToDisplay } from '@/utils/weightUnits';
import { buildExercisePRs, formatE1RM, type SetWithDate } from '@/utils/oneRepMax';
import { formatTick, valueAxis } from '@/utils/chartAxis';
import {
  sessionBestPoints,
  type StrengthSummary,
  strengthAgeNote,
  strengthSummary,
} from '@/utils/personalRecords';

const CHART_HEIGHT = 180;
/** Room for a y-axis label like `117.5`. */
const Y_GUTTER = 40;
/** Keeps the end dots and the top/bottom of the line inside the plot. */
const PLOT_INSET = 6;
const DOT_RADIUS = 4;

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Line chart of each workout's best est. 1RM, oldest → newest, spaced by date. The y-axis is in
 * the user's unit and hugs the data (`valueAxis`), so progress reads as a slope.
 */
function ProgressionChart({
  points,
  colors,
  weightUnit,
}: {
  points: SetWithDate[];
  colors: Record<string, string>;
  weightUnit: 'kg' | 'lb';
}) {
  const chartHeight = useTextScaledSize(CHART_HEIGHT);
  const gutter = useTextScaledSize(Y_GUTTER);
  const [plotWidth, setPlotWidth] = useState(0);
  if (points.length === 0) return null;

  const values = points.map((p) => kgToDisplay(p.estimated1RM, weightUnit));
  const axis = valueAxis(values);
  const times = points.map((p) => new Date(p.completedAt).getTime());
  const t0 = times[0];
  const span = times[times.length - 1] - t0;
  const innerW = Math.max(0, plotWidth - PLOT_INSET * 2);
  const innerH = chartHeight - PLOT_INSET * 2;
  const xOf = (t: number) => PLOT_INSET + (span > 0 ? ((t - t0) / span) * innerW : innerW / 2);
  const yOf = (v: number) => PLOT_INSET + (1 - (v - axis.min) / (axis.max - axis.min)) * innerH;
  const coords = points.map((_, i) => ({ x: xOf(times[i]), y: yOf(values[i]) }));

  const firstDate = formatChartDate(points[0].completedAt);
  const lastDate = formatChartDate(points[points.length - 1].completedAt);
  const legend = `Best est. 1RM per workout (${weightUnit})`;

  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.surfaceElevated }]}>
      <View
        style={[styles.chartRow, { height: chartHeight }]}
        accessible
        accessibilityLabel={`${legend}: ${formatE1RM(points[0].estimated1RM, weightUnit)} on ${firstDate}, ${formatE1RM(points[points.length - 1].estimated1RM, weightUnit)} on ${lastDate}`}
      >
        <View style={{ width: gutter }}>
          {axis.ticks.map((tick) => (
            <Text
              key={tick}
              testID="progression-y-tick"
              style={[styles.yTick, { top: yOf(tick) - 7, color: colors.textMuted }]}
            >
              {formatTick(tick)}
            </Text>
          ))}
        </View>
        <View
          style={styles.plot}
          testID="progression-plot"
          onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.width);
            setPlotWidth((prev) => (prev === next ? prev : next));
          }}
        >
          {plotWidth > 0 && (
            <Svg width={plotWidth} height={chartHeight}>
              {axis.ticks.map((tick) => (
                <Line
                  key={tick}
                  x1={0}
                  x2={plotWidth}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                />
              ))}
              {coords.length > 1 && (
                <Polyline
                  points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {coords.map((c, i) => (
                <Circle
                  key={points[i].completedAt}
                  testID="progression-point"
                  accessibilityLabel={`${formatChartDate(points[i].completedAt)}, ${formatE1RM(points[i].estimated1RM, weightUnit)}`}
                  cx={c.x}
                  cy={c.y}
                  r={DOT_RADIUS}
                  fill={colors.primary}
                  stroke={colors.surfaceElevated}
                  strokeWidth={1.5}
                />
              ))}
            </Svg>
          )}
        </View>
      </View>
      {/* One axis for the whole range: a date under every point can't fit once there are more than a few. */}
      <View style={[styles.chartAxis, { marginLeft: gutter }]}>
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
        <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.legendText, { color: colors.textMuted }]}>{legend}</Text>
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
  const ageNote = strengthAgeNote(strength);
  return (
    <View style={[styles.standardCard, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.standardTitle, { color: colors.text }]}>Strength level: {strength.label}</Text>
      {strength.next && (
        <Text style={[styles.standardHint, { color: colors.textMuted }]}>
          Next ({strength.next.label}): {formatE1RM(strength.next.oneRepMaxKg, weightUnit)}
        </Text>
      )}
      {ageNote && <Text style={[styles.standardHint, { color: colors.textMuted }]}>{ageNote}</Text>}
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
              points={sessionBestPoints(pr.history)}
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
  chartRow: { flexDirection: 'row' },
  plot: { flex: 1, minWidth: 0 },
  yTick: {
    position: 'absolute',
    right: spacing.xs,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: typography.caption.fontFamily,
  },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 11, fontFamily: typography.caption.fontFamily },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: spacing.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
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
