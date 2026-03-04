import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useExercisesStore } from '@/store/exercisesStore';
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
  const weight = set.weightKg != null && set.weightKg > 0
    ? ` @ ${Number(set.weightKg).toFixed(1)} kg`
    : '';
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
      'Delete Workout',
      'This will remove the workout from history and its impact on muscle recovery. This cannot be undone.',
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>History</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Previous workouts you've completed
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/history-monthly')}
            style={({ pressed }) => [
              styles.calendarButton,
              { backgroundColor: colors.surface },
              pressed && styles.calendarButtonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="calendar-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      {completed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No workouts yet. Complete a workout to see it here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cardsContainer}>
            {completed.map((s) => {
              const exercises = exercisesWithCompletedSets(s);
              const hasStats = getSessionDuration(s) || getSessionVolume(s) > 0;
              return (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [
                    styles.workoutCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.workoutCardPressed,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                      {s.completedAt ? formatSessionDate(s.completedAt) : ''}
                    </Text>
                    <Pressable
                      onPress={() => handleDeleteSession(s)}
                      hitSlop={8}
                      style={({ pressed: delPressed }) => [
                        styles.deleteButton,
                        delPressed && styles.deleteButtonPressed,
                      ]}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {getTemplateName(s.templateId)}
                  </Text>
                  {hasStats && (
                    <View style={styles.statsRow}>
                      {getSessionDuration(s) && (
                        <View style={[styles.statChip, { backgroundColor: colors.surfaceElevated }]}>
                          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                          <Text style={[styles.statChipText, { color: colors.textSecondary }]}>
                            {getSessionDuration(s)}
                          </Text>
                        </View>
                      )}
                      {getSessionVolume(s) > 0 && (
                        <View style={[styles.statChip, { backgroundColor: colors.surfaceElevated }]}>
                          <Ionicons name="barbell-outline" size={12} color={colors.textSecondary} />
                          <Text style={[styles.statChipText, { color: colors.textSecondary }]}>
                            {getSessionVolume(s).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {exercises.length > 0 && (
                    <View
                      style={[
                        styles.exerciseList,
                        {
                          borderLeftColor: colors.primary + '40',
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      {exercises.map((se, idx) => {
                        const completedSets = se.sets.filter((set) => set.completed);
                        const exerciseName = getExercise(se.exerciseId)?.name ?? se.exerciseId;
                        const isLast = idx === exercises.length - 1;
                        return (
                          <View key={se.exerciseId} style={[styles.exerciseRow, isLast && styles.exerciseRowLast]}>
                            <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                              {exerciseName}
                            </Text>
                            <View style={styles.setsRow}>
                              {completedSets.map((set, setIdx) => (
                                <View
                                  key={setIdx}
                                  style={[styles.setChip, { backgroundColor: colors.surfaceElevated }]}
                                >
                                  <Text
                                    style={[styles.setChipText, { color: colors.textSecondary }]}
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
                </Pressable>
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
  header: { padding: 20, paddingBottom: 16 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarButtonPressed: { opacity: 0.8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  cardsContainer: { gap: 16 },
  workoutCard: {
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  workoutCardPressed: { opacity: 0.96 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardDate: { fontSize: 12, textTransform: 'capitalize', letterSpacing: 0.3 },
  deleteButton: {
    padding: 6,
  },
  deleteButtonPressed: { opacity: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statChipText: { fontSize: 11, fontWeight: '500' },
  exerciseList: {
    marginTop: 4,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  exerciseRow: { marginBottom: 8 },
  exerciseRowLast: { marginBottom: 0 },
  exerciseName: { fontSize: 13, fontWeight: '600' },
  setsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  setChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setChipText: { fontSize: 11 },
});
