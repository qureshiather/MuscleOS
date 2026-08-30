import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Screen } from '@/components/layout';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useBottomSpace, useDeviceMetrics } from '@/theme/layout';
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
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useRequirePro } from '@/hooks/useProGate';

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
  strengthComparison,
  onPress,
}: {
  pr: ExercisePR;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
  colors: Record<string, string>;
  strengthComparison: {
    level: string;
    nextLevel1RMKg: number | null;
    nextLevelName: string | null;
    hasStandards: boolean;
  } | null;
  onPress: () => void;
}) {
  const { isNarrow } = useDeviceMetrics();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.cardPressed]}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
        <View style={[styles.statsRow, isNarrow && styles.statsRowStacked]}>
          <View style={[styles.stat, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[typography.caption, styles.statLabel, { color: colors.textMuted }]}>
              Est. 1RM
            </Text>
            <Text style={[typography.data, styles.statValue, { color: colors.primary }]}>
              {formatWeight(pr.bestEstimated1RM, weightUnit)}
            </Text>
          </View>
          {pr.bestSet && (
            <View style={[styles.stat, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[typography.caption, styles.statLabel, { color: colors.textMuted }]}>
                Best set
              </Text>
              <Text style={[typography.data, styles.statValue, { color: colors.text }]}>
                {formatWeight(pr.bestSet.weightKg, weightUnit)} × {pr.bestSet.reps}
              </Text>
            </View>
          )}
        </View>
        {strengthComparison?.hasStandards && (
          <View style={[styles.strengthChip, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="fitness-outline" size={14} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {strengthComparison.level}
              {strengthComparison.nextLevelName && strengthComparison.nextLevel1RMKg != null && (
                <Text style={{ color: colors.textMuted }}>
                  {' '}
                  → {strengthComparison.nextLevelName} @{' '}
                  {formatWeight(strengthComparison.nextLevel1RMKg, weightUnit)}
                </Text>
              )}
            </Text>
          </View>
        )}
        {pr.history.length > 1 && (
          <View style={styles.progressSection}>
            <Text style={[typography.caption, styles.progressLabel, { color: colors.textMuted }]}>
              Progress
            </Text>
            <ProgressBars
              history={pr.history}
              max1RM={pr.bestEstimated1RM}
              barColor={colors.primary}
              barBg={colors.surfaceElevated}
            />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

export default function PersonalRecordsScreen() {
  const isPro = useRequirePro('personal_records');
  const { colors } = useTheme();
  const router = useRouter();
  const scrollPaddingBottom = useBottomSpace(spacing.xl);
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

  if (!isPro) return null;

  return (
    <Screen>
      <ScreenHeader
        title="Personal records"
        subtitle="Estimated 1RM & best sets"
        onBack={() => router.back()}
      />
      {allPRs.length > 0 && (
        <>
          <View style={styles.searchWrapper}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textMuted}
              style={styles.searchIcon}
            />
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
              onPress={() => router.push('/(tabs)/profile')}
              style={[
                styles.profileHint,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                Add weight & gender in Profile for strength level comparison
              </Text>
            </Pressable>
          )}
        </>
      )}
      {allPRs.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="trophy-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>
            No records yet
          </Text>
          <Text style={[typography.body, styles.emptyText, { color: colors.textMuted }]}>
            Log weight and reps in a workout to see estimated 1RM and best sets here.
          </Text>
        </View>
      ) : prs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
            No exercises match “{search}”
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom }]}
          showsVerticalScrollIndicator={false}
        >
          {prs.map((pr) => {
            const exerciseName = getExercise(pr.exerciseId)?.name ?? pr.exerciseId;
            const strengthComparison =
              profile.weightKg != null && profile.weightKg > 0 && profile.sex
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
  scroll: { padding: spacing.lg + 4 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg + 4,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    paddingLeft: 40,
    paddingRight: 40,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    borderWidth: 1,
  },
  clearBtn: { position: 'absolute', right: 12 },
  profileHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg + 4,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  card: { marginBottom: spacing.md, padding: spacing.lg },
  cardPressed: { opacity: 0.92 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  strengthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statsRowStacked: { flexDirection: 'column' },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  statLabel: {
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: { marginTop: 2 },
  progressSection: { marginTop: spacing.xs },
  progressLabel: {
    fontFamily: typography.label.fontFamily,
    marginBottom: spacing.sm - 2,
  },
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
