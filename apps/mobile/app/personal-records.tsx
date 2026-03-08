import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
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

const MAX_BARS = 10;

function ProgressBars({
  history,
  max1RM,
  barColor,
  barBg,
}: {
  history: SetWithDate[];
  max1RM: number;
  barColor: string;
  barBg: string;
}) {
  const points = history.slice(0, MAX_BARS);
  if (points.length === 0) return null;
  return (
    <View style={styles.barsRow}>
      {points.map((p, i) => {
        const ratio = max1RM > 0 ? Math.min(1, p.estimated1RM / max1RM) : 0;
        return (
          <View key={`${p.completedAt}-${i}`} style={[styles.barWrap, { backgroundColor: barBg }]}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: barColor,
                  flex: ratio || 0.01,
                },
              ]}
            />
            <View style={[styles.barSpacer, { flex: Math.max(0, 1 - ratio) }]} />
          </View>
        );
      })}
    </View>
  );
}

function PRCard({
  pr,
  exerciseName,
  weightUnit,
  colors,
}: {
  pr: ExercisePR;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
  colors: Record<string, string>;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
        {exerciseName}
      </Text>
      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Est. 1RM</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {formatWeight(pr.bestEstimated1RM, weightUnit)}
          </Text>
        </View>
        {pr.bestSet && (
          <View style={[styles.stat, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best set</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatWeight(pr.bestSet.weightKg, weightUnit)} × {pr.bestSet.reps}
            </Text>
          </View>
        )}
      </View>
      {pr.history.length > 1 && (
        <View style={styles.progressSection}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Progress</Text>
          <ProgressBars
            history={pr.history}
            max1RM={pr.bestEstimated1RM}
            barColor={colors.primary}
            barBg={colors.surfaceElevated}
          />
        </View>
      )}
    </View>
  );
}

export default function PersonalRecordsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const loadSessions = useSessionsStore((s) => s.load);
  const completedSessions = useSessionsStore((s) => s.completedSessions);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const weightUnit = useSettingsStore((s) => s.weightUnit);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const prs = buildExercisePRs(completed);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>Personal Records</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Estimated 1RM & best sets from your workouts
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      {prs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Complete workouts with weight and reps to see your personal records and estimated 1RM here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {prs.map((pr) => (
            <PRCard
              key={pr.exerciseId}
              pr={pr}
              exerciseName={getExercise(pr.exerciseId)?.name ?? pr.exerciseId}
              weightUnit={weightUnit}
              colors={colors}
            />
          ))}
        </ScrollView>
      )}
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
  backButton: { padding: 8 },
  backButtonPressed: { opacity: 0.7 },
  headerCenter: { flex: 1, marginLeft: 8 },
  headerRight: { width: 40 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: { fontSize: 15, textAlign: 'center', marginTop: 12 },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  exerciseName: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  progressSection: { marginTop: 4 },
  progressLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  barsRow: { flexDirection: 'row', gap: 4, alignItems: 'stretch', height: 20 },
  barWrap: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    minWidth: 8,
  },
  barFill: { minWidth: 2 },
  barSpacer: {},
});
