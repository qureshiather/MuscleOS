import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
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
import {
  compareToStrengthStandards,
  STRENGTH_LEVEL_LABELS,
} from '@/data/strengthStandards';

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
  exerciseId,
  exerciseName,
  weightUnit,
  colors,
  strengthComparison,
  onPress,
}: {
  pr: ExercisePR;
  exerciseId: string;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
  colors: Record<string, string>;
  strengthComparison: { level: string; nextLevel1RMKg: number | null; nextLevelName: string | null; hasStandards: boolean } | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
          {exerciseName}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
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
      {strengthComparison?.hasStandards && (
        <View style={[styles.strengthChip, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="fitness-outline" size={14} color={colors.primary} />
          <Text style={[styles.strengthText, { color: colors.textSecondary }]}>
            {strengthComparison.level}
            {strengthComparison.nextLevelName && strengthComparison.nextLevel1RMKg != null && (
              <Text style={[styles.strengthNext, { color: colors.textMuted }]}>
                {' '}→ {strengthComparison.nextLevelName} @ {formatWeight(strengthComparison.nextLevel1RMKg, weightUnit)}
              </Text>
            )}
          </Text>
        </View>
      )}
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
    </Pressable>
  );
}

export default function PersonalRecordsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
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
  const prs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPRs;
    return allPRs.filter((pr) => {
      const name = getExercise(pr.exerciseId)?.name ?? pr.exerciseId;
      return name.toLowerCase().includes(q);
    });
  }, [allPRs, search, getExercise]);

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
            Estimated 1RM & best sets · Tap for progression
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      {allPRs.length > 0 && (
        <>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={8}
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        {(profile.weightKg == null || profile.weightKg <= 0 || !profile.sex) && (
          <Pressable
            onPress={() => router.push('/profile')}
            style={[styles.profileHint, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.profileHintText, { color: colors.textMuted }]}>
              Add weight & gender in Profile for strength level comparison
            </Text>
          </Pressable>
        )}
        </>
      )}
      {allPRs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Complete workouts with weight and reps to see your personal records and estimated 1RM here.
          </Text>
        </View>
      ) : prs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No exercises match "{search}"
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {prs.map((pr) => {
            const exerciseName = getExercise(pr.exerciseId)?.name ?? pr.exerciseId;
            const strengthComparison =
              profile.weightKg != null &&
              profile.weightKg > 0 &&
              profile.sex
                ? compareToStrengthStandards(
                    pr.exerciseId,
                    pr.bestEstimated1RM,
                    profile.weightKg,
                    profile.sex
                  )
                : null;
            return (
              <PRCard
                key={pr.exerciseId}
                pr={pr}
                exerciseId={pr.exerciseId}
                exerciseName={exerciseName}
                weightUnit={weightUnit}
                colors={colors}
                strengthComparison={
                  strengthComparison
                    ? {
                        level: STRENGTH_LEVEL_LABELS[strengthComparison.level],
                        nextLevel1RMKg: strengthComparison.nextLevel1RMKg,
                        nextLevelName: strengthComparison.nextLevelName,
                        hasStandards: strengthComparison.hasStandards,
                      }
                    : null
                }
                onPress={() =>
                  router.push({
                    pathname: '/exercise-progression',
                    params: { exerciseId: pr.exerciseId },
                  })
                }
              />
            );
          })}
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
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 40,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
  },
  clearBtn: { position: 'absolute', right: 12 },
  profileHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
  },
  profileHintText: { fontSize: 13, flex: 1 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardPressed: { opacity: 0.92 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: { fontSize: 17, fontWeight: '600', flex: 1 },
  strengthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  strengthText: { fontSize: 13 },
  strengthNext: { fontSize: 12 },
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
