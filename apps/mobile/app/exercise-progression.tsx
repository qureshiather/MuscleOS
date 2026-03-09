import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Exercise</Text>
        </View>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No progression data for this exercise.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Progression & 1RM history
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Best est. 1RM</Text>
          <Text style={[styles.cardValue, { color: colors.primary }]}>
            {formatWeight(pr.bestEstimated1RM, weightUnit)}
          </Text>
          {pr.bestSet && (
            <Text style={[styles.bestSetText, { color: colors.textSecondary }]}>
              Best set: {formatWeight(pr.bestSet.weightKg, weightUnit)} × {pr.bestSet.reps}
            </Text>
          )}
        </View>

        {comparison && (
          <StrengthStandardBar
            comparison={comparison}
            weightUnit={weightUnit}
            colors={colors}
          />
        )}

        {pr.history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            All recorded sets
          </Text>
          {[...pr.history].map((p, i) => (
            <View
              key={`${p.completedAt}-${i}`}
              style={[styles.historyRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                {formatChartDate(p.completedAt)}
              </Text>
              <Text style={[styles.historySet, { color: colors.text }]}>
                {formatWeight(p.weightKg, weightUnit)} × {p.reps}
              </Text>
              <Text style={[styles.history1RM, { color: colors.primary }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  backBtnPressed: { opacity: 0.7 },
  headerCenter: { flex: 1, marginLeft: 8, minWidth: 0 },
  headerRight: { width: 40 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: '700' },
  bestSetText: { fontSize: 14, marginTop: 6 },
  standardCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  standardTitle: { fontSize: 16, fontWeight: '600' },
  standardHint: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chartContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  barLabel: { fontSize: 9, marginTop: 4 },
  chartLegend: { marginTop: 8 },
  legendText: { fontSize: 11 },
  historySection: { marginTop: 8 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  historyDate: { width: 80, fontSize: 14 },
  historySet: { flex: 1, fontSize: 15, fontWeight: '500' },
  history1RM: { fontSize: 14, fontWeight: '600' },
});
