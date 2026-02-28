import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { getExercise } from '@/data/exercises';
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
  const { load: loadSessions, completedSessions } = useSessionsStore();
  const allTemplates = useTemplatesStore((s) => s.allTemplates);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>History</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Previous workouts you’ve completed
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
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.cardsContainer}>
            {completed.map((s) => {
              const exercises = exercisesWithCompletedSets(s);
              return (
                <View
                  key={s.id}
                  style={[styles.workoutCard, { backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                    {s.completedAt ? formatSessionDate(s.completedAt) : ''}
                  </Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {s.dayName} · {getTemplateName(s.templateId)}
                  </Text>
                  {(getSessionDuration(s) || getSessionVolume(s) > 0) && (
                    <View style={styles.statsRow}>
                      {getSessionDuration(s) && (
                        <View style={styles.stat}>
                          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.statText, { color: colors.textSecondary }]}>
                            {getSessionDuration(s)}
                          </Text>
                        </View>
                      )}
                      {getSessionVolume(s) > 0 && (
                        <View style={styles.stat}>
                          <Ionicons name="barbell-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.statText, { color: colors.textSecondary }]}>
                            {getSessionVolume(s).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {exercises.length > 0 && (
                    <View style={styles.exerciseList}>
                      {exercises.map((se) => {
                        const completedSets = se.sets.filter((set) => set.completed);
                        const setsSummary = completedSets
                          .map((set) => formatSet(set))
                          .join(' · ');
                        const exerciseName = getExercise(se.exerciseId)?.name ?? se.exerciseId;
                        return (
                          <View key={se.exerciseId} style={styles.exerciseRow}>
                            <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                              {exerciseName}
                            </Text>
                            <Text style={[styles.setsWeight, { color: colors.textSecondary }]}>
                              {completedSets.length} set{completedSets.length !== 1 ? 's' : ''}
                              {setsSummary ? ` · ${setsSummary}` : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
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
  cardsContainer: { gap: 12 },
  workoutCard: {
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
  },
  cardDate: { fontSize: 13, marginBottom: 4, textTransform: 'capitalize' },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13 },
  exerciseList: {
    marginTop: 4,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  exerciseRow: { marginBottom: 8 },
  exerciseName: { fontSize: 15, fontWeight: '500' },
  setsWeight: { fontSize: 13, marginTop: 2 },
});
