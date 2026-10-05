import { useCallback, useState } from 'react';
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
import { completedNewestFirst, useSessionsStore } from '@/store/sessionsStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatWeight } from '@/utils/weightUnits';
import { buildExercisePRs, type ExercisePR, formatE1RM } from '@/utils/oneRepMax';
import {
  filterPRsByName,
  hasStrengthProfile,
  type PRCardModel,
  type ProgressPoint,
  prCardModel,
} from '@/utils/personalRecords';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';

function ProgressBars({
  bars,
  barColor,
  barBg,
}: {
  bars: ProgressPoint[];
  barColor: string;
  barBg: string;
}) {
  return (
    <View style={styles.barsRow}>
      {bars.map((p, i) => (
        <View
          key={`${p.completedAt}-${i}`}
          testID="pr-bar"
          style={[styles.barWrap, { backgroundColor: barBg }]}
        >
          <View style={[styles.barFill, { backgroundColor: barColor, flex: p.ratio || 0.01 }]} />
          <View style={[styles.barSpacer, { flex: Math.max(0, 1 - p.ratio) }]} />
        </View>
      ))}
    </View>
  );
}

function PRCard({
  pr,
  model,
  exerciseName,
  weightUnit,
  colors,
  onPress,
}: {
  pr: ExercisePR;
  model: PRCardModel;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
  colors: Record<string, string>;
  onPress: () => void;
}) {
  const { isNarrow } = useDeviceMetrics();
  const { strength, bars } = model;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={exerciseName}
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
              {formatE1RM(pr.bestEstimated1RM, weightUnit)}
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
        {strength && (
          <View style={[styles.strengthChip, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="fitness-outline" size={14} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {strength.label}
              {strength.next && (
                <Text style={{ color: colors.textMuted }}>
                  {` → ${strength.next.label} @ ${formatE1RM(strength.next.oneRepMaxKg, weightUnit)}`}
                </Text>
              )}
            </Text>
          </View>
        )}
        {bars && (
          <View style={styles.progressSection}>
            <Text style={[typography.caption, styles.progressLabel, { color: colors.textMuted }]}>
              Progress
            </Text>
            <ProgressBars bars={bars} barColor={colors.primary} barBg={colors.surfaceElevated} />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

export default function PersonalRecordsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const scrollPaddingBottom = useBottomSpace(spacing.xl);
  const [search, setSearch] = useState('');
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
  // Keyed by canonical id so alias-logged sets merge into the current catalog exercise.
  const allPRs = buildExercisePRs(completed, (id) => getExercise(id)?.id ?? id);
  const nameOf = (id: string) => getExercise(id)?.name ?? id;
  const prs = filterPRsByName(allPRs, search, nameOf);


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
              accessibilityLabel="Search exercises"
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
          {!hasStrengthProfile(profile) && (
            <Pressable
              onPress={() => router.push('/biodata')}
              style={[
                styles.profileHint,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>
                Add weight & gender in Biodata for strength level comparison
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
          {prs.map((pr) => (
            <PRCard
              key={pr.exerciseId}
              pr={pr}
              model={prCardModel(pr, profile)}
              exerciseName={nameOf(pr.exerciseId)}
              weightUnit={weightUnit}
              colors={colors}
              onPress={() =>
                router.push({
                  pathname: '/exercise-progression',
                  params: { exerciseId: pr.exerciseId },
                })
              }
            />
          ))}
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
