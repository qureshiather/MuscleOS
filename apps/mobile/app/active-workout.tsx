import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getExercise } from '@/data/exercises';
import { PlateCalculator } from '@/components/PlateCalculator';
import { kgToDisplay, displayToKg } from '@/utils/weightUnits';
import { getExercisePrevious } from '@/storage/localStorage';

const DEFAULT_REST_SECONDS = 90;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const weightLabel = weightUnit === 'lb' ? 'LB' : 'KG';

  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restAfter, setRestAfter] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [editingWeightExIdx, setEditingWeightExIdx] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ exIdx: number; setIdx: number; field: 'kg' | 'reps' } | null>(null);
  const [previousMap, setPreviousMap] = useState<Record<string, { weightKg: number; reps?: number }>>({});

  useEffect(() => {
    if (params.templateId && params.dayId && params.dayName && params.exerciseIds && !session) {
      const ids = params.exerciseIds.split(',').filter(Boolean);
      startWorkout(params.templateId, params.dayId, params.dayName, ids);
    }
  }, [params.templateId, params.dayId, params.dayName, params.exerciseIds, session, startWorkout]);

  useEffect(() => {
    if (!session) return;
    getExercisePrevious().then((prev) => {
      setPreviousMap(prev);
      const current = useActiveWorkoutStore.getState().session;
      if (!current) return;
      current.exercises.forEach((se, exIdx) => {
        const p = prev[se.exerciseId];
        const firstSet = se.sets[0];
        if (p && firstSet && firstSet.weightKg == null && firstSet.reps == null) {
          setSetRecord(exIdx, 0, { weightKg: p.weightKg, reps: p.reps });
        }
      });
    });
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsedMs(Date.now() - start);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session?.startedAt]);

  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setRestSecondsLeft((s) => (s === null || s <= 1 ? null : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [restSecondsLeft]);

  function startRest(exIdx: number, setIdx: number) {
    setRestAfter({ exIdx, setIdx });
    setRestSecondsLeft(DEFAULT_REST_SECONDS);
  }

  async function handleFinish() {
    await finishWorkout();
    router.replace('/(tabs)');
  }

  function handleCancel() {
    discardWorkout();
    router.replace('/(tabs)');
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </Pressable>
          <Text style={[styles.elapsed, { color: colors.text }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allDone = session.exercises.every((ex) => ex.sets.every((s) => s.completed));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header: Back | Time (center) | Finish */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerLeft}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.elapsed, { color: colors.text }]}>{formatElapsed(elapsedMs)}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={handleFinish}
            disabled={!allDone}
            style={[styles.finishHeaderBtn, !allDone && styles.finishHeaderBtnDisabled]}
          >
            <Text style={[styles.finishHeaderText, { color: allDone ? colors.accent : colors.textMuted }]}>
              FINISH
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {session.exercises.map((se, exIdx) => {
          const exercise = getExercise(se.exerciseId);
          const isBarbell = exercise?.equipment.includes('barbell');
          const currentWeightKg =
            se.sets.find((s) => s.weightKg != null && s.weightKg > 0)?.weightKg ?? 0;

          return (
            <View
              key={se.exerciseId + exIdx}
              style={[styles.exerciseCard, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.exerciseName, { color: colors.accent }]}>
                {exercise?.name ?? se.exerciseId}
              </Text>

              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.thSet, { color: colors.textMuted }]}>SET</Text>
                <Text style={[styles.th, styles.thPrev, { color: colors.textMuted }]}>PREV</Text>
                <Text style={[styles.th, styles.thKg, { color: colors.textMuted }]}>{weightLabel}</Text>
                <Text style={[styles.th, styles.thReps, { color: colors.textMuted }]}>REPS</Text>
                <View style={styles.thDone} />
              </View>

              {se.sets.map((set, setIdx) => {
                const isResting =
                  restAfter?.exIdx === exIdx &&
                  restAfter?.setIdx === setIdx &&
                  restSecondsLeft !== null &&
                  restSecondsLeft > 0;
                const isKgFocused = focusedCell?.exIdx === exIdx && focusedCell?.setIdx === setIdx && focusedCell?.field === 'kg';
                const isRepsFocused = focusedCell?.exIdx === exIdx && focusedCell?.setIdx === setIdx && focusedCell?.field === 'reps';
                const prev = previousMap[se.exerciseId];
                const prevLabel = prev
                  ? `${kgToDisplay(prev.weightKg, weightUnit)}${prev.reps != null ? ` × ${prev.reps}` : ''}`
                  : '—';

                return (
                  <View key={setIdx}>
                    <View style={styles.setRow}>
                      <Text style={[styles.setLabel, { color: colors.textSecondary }]}>
                        {setIdx + 1}
                      </Text>
                      <Text style={[styles.prevCell, { color: colors.textMuted }]} numberOfLines={1}>
                        {prevLabel}
                      </Text>
                      <TextInput
                        style={[
                          styles.setInput,
                          {
                            backgroundColor: isKgFocused ? colors.background : colors.surface,
                            color: colors.text,
                            borderColor: isKgFocused ? colors.border : 'transparent',
                            borderWidth: isKgFocused ? 1 : 0,
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        value={set.weightKg !== undefined ? String(kgToDisplay(set.weightKg, weightUnit)) : ''}
                        onChangeText={(t) =>
                          setSetRecord(exIdx, setIdx, {
                            weightKg: t === '' ? undefined : displayToKg(parseFloat(t) || 0, weightUnit),
                          })
                        }
                        onFocus={() => {
                          setFocusedCell({ exIdx, setIdx, field: 'kg' });
                          setEditingWeightExIdx(exIdx);
                        }}
                        onBlur={() => {
                          setFocusedCell(null);
                          setEditingWeightExIdx(null);
                        }}
                      />
                      <TextInput
                        style={[
                          styles.setInput,
                          {
                            backgroundColor: isRepsFocused ? colors.background : colors.surface,
                            color: colors.text,
                            borderColor: isRepsFocused ? colors.border : 'transparent',
                            borderWidth: isRepsFocused ? 1 : 0,
                          },
                        ]}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        value={set.reps !== undefined ? String(set.reps) : ''}
                        onChangeText={(t) =>
                          setSetRecord(exIdx, setIdx, {
                            reps: t === '' ? undefined : parseInt(t, 10),
                          })
                        }
                        onFocus={() => setFocusedCell({ exIdx, setIdx, field: 'reps' })}
                        onBlur={() => setFocusedCell(null)}
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
                        <Text style={[styles.doneBtnText, { color: set.completed ? '#fff' : colors.textSecondary }]}>
                          ✓
                        </Text>
                      </Pressable>
                    </View>
                    {isResting && (
                      <View style={[styles.restBar, { backgroundColor: colors.surfaceElevated }]}>
                        <View
                          style={[
                            styles.restBarFill,
                            {
                              width: `${((DEFAULT_REST_SECONDS - restSecondsLeft) / DEFAULT_REST_SECONDS) * 100}%`,
                              backgroundColor: colors.accent,
                            },
                          ]}
                        />
                        <Text style={[styles.restTimerInline, { color: colors.accent }]}>
                          {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
                        </Text>
                        <Pressable onPress={() => setRestSecondsLeft(0)} style={styles.skipRestInline}>
                          <Text style={[styles.skipRestText, { color: colors.textMuted }]}>Skip</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              {isBarbell && editingWeightExIdx === exIdx && (
                <PlateCalculator totalKg={currentWeightKg || 20} unit={weightUnit} />
              )}
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

        <Pressable
          style={styles.cancelWorkoutBtn}
          onPress={() => {
            Alert.alert(
              'Cancel workout',
              'This workout will not be saved. Are you sure?',
              [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel workout', style: 'destructive', onPress: handleCancel }]
            );
          }}
        >
          <Text style={[styles.cancelWorkoutText, { color: colors.textMuted }]}>Cancel workout</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { minWidth: 56 },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 56 },
  backText: { fontSize: 16 },
  elapsed: { fontSize: 20, fontWeight: '700' },
  finishHeaderBtn: { minWidth: 48, alignItems: 'flex-end' },
  finishHeaderBtnDisabled: { opacity: 0.7 },
  finishHeaderText: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  exerciseCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  exerciseName: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  th: { fontSize: 12, fontWeight: '600' },
  thSet: { width: 28 },
  thPrev: { width: 48 },
  thKg: { flex: 1, minWidth: 56 },
  thReps: { flex: 1, minWidth: 56 },
  thDone: { width: 40 },
  setLabel: { width: 28, fontSize: 14 },
  prevCell: { width: 48, fontSize: 13 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  setInput: {
    flex: 1,
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  doneBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16 },
  restBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  restBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  restTimerInline: { fontSize: 18, fontWeight: '700', zIndex: 1 },
  skipRestInline: { marginLeft: 'auto', zIndex: 1, padding: 8 },
  skipRestText: { fontSize: 14 },
  finishBtn: {
    padding: 18,
    borderRadius: 14,
    marginTop: 8,
  },
  finishBtnText: { color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  cancelWorkoutBtn: {
    paddingVertical: 18,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelWorkoutText: { fontSize: 15 },
});
