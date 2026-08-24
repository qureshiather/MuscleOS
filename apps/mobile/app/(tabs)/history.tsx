import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { screenHeaderStyles } from '@/theme/screenHeader';
import { typography } from '@/theme/typography';
import { radius, spacing } from '@/theme/tokens';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { Card } from '@/components/ui/Card';
import { StatChip } from '@/components/ui/StatChip';
import type { WorkoutSession, SessionExercise, SetRecord } from '@muscleos/types';

function formatSessionDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatSet(set: SetRecord): string {
  const reps = set.reps != null ? `${set.reps}` : '?';
  const weight =
    set.weightKg != null && set.weightKg > 0 ? ` @ ${Number(set.weightKg).toFixed(1)} kg` : '';
  return `${reps}${weight}`;
}

function getSessionDuration(session: WorkoutSession): string | null {
  if (!session.startedAt || !session.completedAt) return null;
  const ms = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getSessionVolume(session: WorkoutSession): number {
  let total = 0;
  for (const se of session.exercises) {
    for (const set of se.sets) {
      if (!set.completed) continue;
      const reps = set.reps ?? 0;
      const kg = set.weightKg ?? 0;
      total += kg * reps;
    }
  }
  return total;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { load: loadSessions, completedSessions, deleteSession } = useSessionsStore();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const loadRecovery = useRecoveryStore((s) => s.load);
  const getExercise = useExercisesStore((s) => s.getExercise);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const completed = completedSessions();
  const templates = allTemplates();
  const getTemplateName = (templateId: string) =>
    templates.find((t) => t.id === templateId)?.name ?? 'Workout';

  function exercisesWithCompletedSets(session: WorkoutSession): SessionExercise[] {
    return session.exercises.filter((se) => se.sets.some((s) => s.completed));
  }

  function handleDeleteSession(session: WorkoutSession) {
    Alert.alert(
      'Delete workout',
      'Removes this session from history and its recovery impact. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(session.id);
            loadRecovery();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={screenHeaderStyles.headerFixed}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={[screenHeaderStyles.title, { color: colors.text }]}>History</Text>
            <Text style={[screenHeaderStyles.subtitle, { color: colors.textSecondary }]}>
              Past sessions & volume
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => router.push('/personal-records')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="trophy-outline" size={22} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/history-monthly')}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.iconButtonPressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
      {completed.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="time-outline" size={28} color={colors.textMuted} />
          </View>
          <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>
            No sessions yet
          </Text>
          <Text style={[typography.body, styles.emptyText, { color: colors.textMuted }]}>
            Finish a workout and it will show up here with duration, volume, and sets.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[screenHeaderStyles.scrollContent, { paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardsContainer}>
            {completed.map((s) => {
              const exercises = exercisesWithCompletedSets(s);
              const duration = getSessionDuration(s);
              const volume = getSessionVolume(s);
              return (
                <Card key={s.id} style={styles.workoutCard}>
                  <View style={styles.cardHeader}>
                    <Text style={[typography.caption, styles.cardDate, { color: colors.textSecondary }]}>
                      {s.completedAt ? formatSessionDate(s.completedAt) : ''}
                    </Text>
                    <Pressable
                      onPress={() => handleDeleteSession(s)}
                      hitSlop={8}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: spacing.xs }]}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={[typography.bodyMedium, styles.cardTitle, { color: colors.text }]}>
                    {getTemplateName(s.templateId)}
                  </Text>
                  {(duration || volume > 0) && (
                    <View style={styles.statsRow}>
                      {duration ? <StatChip icon="time-outline" label={duration} /> : null}
                      {volume > 0 ? (
                        <StatChip
                          icon="barbell-outline"
                          label={`${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`}
                        />
                      ) : null}
                    </View>
                  )}
                  {exercises.length > 0 && (
                    <View
                      style={[
                        styles.exerciseList,
                        {
                          borderLeftColor: colors.primary + '55',
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      {exercises.map((se, idx) => {
                        const completedSets = se.sets.filter((set) => set.completed);
                        const exerciseName = getExercise(se.exerciseId)?.name ?? se.exerciseId;
                        const isLast = idx === exercises.length - 1;
                        return (
                          <View
                            key={se.exerciseId}
                            style={[styles.exerciseRow, isLast && styles.exerciseRowLast]}
                          >
                            <Text
                              style={[typography.label, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {exerciseName}
                            </Text>
                            <View style={styles.setsRow}>
                              {completedSets.map((set, setIdx) => (
                                <View
                                  key={setIdx}
                                  style={[styles.setChip, { backgroundColor: colors.surfaceElevated }]}
                                >
                                  <Text
                                    style={[typography.caption, styles.setChipText, { color: colors.textSecondary }]}
                                    numberOfLines={1}
                                  >
                                    {formatSet(set)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextBlock: {
    flex: 1,
    marginRight: spacing.sm,
    minWidth: 0,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { opacity: 0.8 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
  cardsContainer: { gap: spacing.md },
  workoutCard: {
    padding: spacing.md + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },
  cardDate: { textTransform: 'capitalize', letterSpacing: 0.2 },
  cardTitle: { marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  exerciseList: {
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
  },
  exerciseRow: { marginBottom: spacing.sm },
  exerciseRowLast: { marginBottom: 0 },
  setsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  setChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm - 2,
  },
  setChipText: {
    fontFamily: typography.data.fontFamily,
  },
});
