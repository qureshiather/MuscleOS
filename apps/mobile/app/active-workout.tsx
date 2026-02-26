import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { getExercise } from '@/data/exercises';

const DEFAULT_REST_SECONDS = 90;

export default function ActiveWorkoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    templateId?: string;
    dayId?: string;
    dayName?: string;
    exerciseIds?: string;
  }>();
  const session = useActiveWorkoutStore((s) => s.session);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const setSetRecord = useActiveWorkoutStore((s) => s.setSetRecord);
  const completeSet = useActiveWorkoutStore((s) => s.completeSet);
  const finishWorkout = useActiveWorkoutStore((s) => s.finishWorkout);
  const discardWorkout = useActiveWorkoutStore((s) => s.discardWorkout);

  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restLabel, setRestLabel] = useState('');

  useEffect(() => {
    if (
      params.templateId &&
      params.dayId &&
      params.dayName &&
      params.exerciseIds &&
      !session
    ) {
      const ids = params.exerciseIds.split(',').filter(Boolean);
      startWorkout(params.templateId, params.dayId, params.dayName, ids);
    }
  }, [params.templateId, params.dayId, params.dayName, params.exerciseIds, session, startWorkout]);

  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setRestSecondsLeft((s) => (s === null || s <= 1 ? null : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [restSecondsLeft]);

  function startRest(afterExerciseIndex: number, afterSetIndex: number) {
    const ex = session?.exercises[afterExerciseIndex];
    const name = ex ? getExercise(ex.exerciseId)?.name : '';
    setRestLabel(`Rest after ${name} – Set ${afterSetIndex + 1}`);
    setRestSecondsLeft(DEFAULT_REST_SECONDS);
  }

  async function handleFinish() {
    await finishWorkout();
    router.replace('/(tabs)');
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (restSecondsLeft !== null && restSecondsLeft > 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.restContainer}>
          <Text style={[styles.restLabel, { color: colors.textSecondary }]}>{restLabel}</Text>
          <Text style={[styles.restTimer, { color: colors.primary }]}>
            {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
          </Text>
          <Pressable
            style={[styles.skipRest, { backgroundColor: colors.surface }]}
            onPress={() => setRestSecondsLeft(null)}
          >
            <Text style={[styles.skipRestText, { color: colors.text }]}>Skip rest</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const allDone = session.exercises.every((ex) =>
    ex.sets.every((s) => s.completed)
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            discardWorkout();
            router.back();
          }}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{session.dayName}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {session.exercises.map((se, exIdx) => {
          const exercise = getExercise(se.exerciseId);
          return (
            <View
              key={se.exerciseId + exIdx}
              style={[styles.exerciseCard, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.exerciseName, { color: colors.text }]}>
                {exercise?.name ?? se.exerciseId}
              </Text>
              {se.sets.map((set, setIdx) => (
                <View key={setIdx} style={styles.setRow}>
                  <Text style={[styles.setLabel, { color: colors.textSecondary }]}>
                    Set {setIdx + 1}
                  </Text>
                  <TextInput
                    style={[styles.setInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="Reps"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    value={set.reps !== undefined ? String(set.reps) : ''}
                    onChangeText={(t) =>
                      setSetRecord(exIdx, setIdx, { reps: t === '' ? undefined : parseInt(t, 10) })
                    }
                  />
                  <TextInput
                    style={[styles.setInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="kg"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={set.weightKg !== undefined ? String(set.weightKg) : ''}
                    onChangeText={(t) =>
                      setSetRecord(exIdx, setIdx, {
                        weightKg: t === '' ? undefined : parseFloat(t) || undefined,
                      })
                    }
                  />
                  <Pressable
                    style={[
                      styles.doneBtn,
                      set.completed
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surfaceElevated },
                    ]}
                    onPress={() => {
                      completeSet(exIdx, setIdx);
                      if (setIdx < se.sets.length - 1) startRest(exIdx, setIdx);
                    }}
                  >
                    <Text
                      style={[
                        styles.doneBtnText,
                        { color: set.completed ? '#fff' : colors.textSecondary },
                      ]}
                    >
                      {set.completed ? 'Done' : 'Done'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
        <Pressable
          style={[styles.finishBtn, { backgroundColor: colors.primary }]}
          onPress={handleFinish}
          disabled={!allDone}
        >
          <Text style={styles.finishBtnText}>
            {allDone ? 'Finish workout' : 'Complete all sets to finish'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    paddingBottom: 8,
  },
  backText: { fontSize: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  exerciseCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  exerciseName: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setLabel: { width: 44, fontSize: 14 },
  setInput: {
    width: 56,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneBtnText: { fontSize: 14, fontWeight: '600' },
  restContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  restLabel: { fontSize: 16, marginBottom: 16 },
  restTimer: { fontSize: 48, fontWeight: '700', marginBottom: 24 },
  skipRest: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  skipRestText: { fontSize: 16 },
  finishBtn: {
    padding: 18,
    borderRadius: 14,
    marginTop: 8,
  },
  finishBtnText: { color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
