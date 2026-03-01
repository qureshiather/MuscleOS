import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useActiveWorkoutStore } from '@/store/activeWorkoutStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { PlateCalculator } from '@/components/PlateCalculator';
import { kgToDisplay, displayToKg } from '@/utils/weightUnits';
import { getExercisePrevious } from '@/storage/localStorage';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_REST_SECONDS = 120; // 2:00 default like reference app

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SwipeableSetRow({
  onRemove,
  canDelete,
  dangerColor,
  children,
}: {
  onRemove: () => void;
  canDelete: boolean;
  dangerColor: string;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowWidthRef = useRef(0);
  const canDeleteRef = useRef(canDelete);
  canDeleteRef.current = canDelete;
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;
  const [swiping, setSwiping] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          canDeleteRef.current && g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy),
        onMoveShouldSetPanResponderCapture: (_, g) =>
          canDeleteRef.current && g.dx < -15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: () => setSwiping(true),
        onPanResponderMove: (_, g) => {
          translateX.setValue(Math.min(0, g.dx));
        },
        onPanResponderRelease: (_, g) => {
          const half = rowWidthRef.current ? rowWidthRef.current / 2 : 150;
          if (g.dx < -half) {
            Animated.timing(translateX, {
              toValue: -(rowWidthRef.current || 400),
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              onRemoveRef.current();
              translateX.setValue(0);
              setSwiping(false);
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start(() => setSwiping(false));
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => setSwiping(false));
        },
      }),
    []
  );

  return (
    <View
      style={styles.swipeableContainer}
      onLayout={(e) => {
        rowWidthRef.current = e.nativeEvent.layout.width;
      }}
    >
      {swiping && (
        <View style={[styles.swipeableReveal, { backgroundColor: dangerColor }]}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </View>
      )}
      <Animated.View
        style={canDelete ? { transform: [{ translateX }] } : undefined}
        {...(canDelete ? panResponder.panHandlers : {})}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function ActiveWorkoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    templateId?: string;
    dayId?: string;
    dayName?: string;
    exerciseIds?: string;
    defaultSets?: string;
  }>();
  const session = useActiveWorkoutStore((s) => s.session);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const setSetRecord = useActiveWorkoutStore((s) => s.setSetRecord);
  const completeSet = useActiveWorkoutStore((s) => s.completeSet);
  const uncompleteSet = useActiveWorkoutStore((s) => s.uncompleteSet);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const addExercise = useActiveWorkoutStore((s) => s.addExercise);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const replaceTemplateAndAddExercise = useActiveWorkoutStore((s) => s.replaceTemplateAndAddExercise);
  const finishWorkout = useActiveWorkoutStore((s) => s.finishWorkout);
  const discardWorkout = useActiveWorkoutStore((s) => s.discardWorkout);
  const subscriptionState = useSubscriptionStore((s) => s.state);
  const isPro = subscriptionState?.tier === 'pro' && (!subscriptionState?.expiresAt || new Date(subscriptionState.expiresAt) > new Date());
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const getAllExercises = useExercisesStore((s) => s.getAllExercises);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const weightLabel = weightUnit === 'lb' ? 'LB' : 'KG';

  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restTotalSeconds, setRestTotalSeconds] = useState(DEFAULT_REST_SECONDS);
  const [restAfter, setRestAfter] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [restDurationsBetweenSets, setRestDurationsBetweenSets] = useState<Record<string, number>>({});
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [showRestControlSheet, setShowRestControlSheet] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [editingWeightExIdx, setEditingWeightExIdx] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ exIdx: number; setIdx: number; field: 'kg' | 'reps' } | null>(null);
  const [previousMap, setPreviousMap] = useState<Record<string, { weightKg: number; reps?: number }>>({});
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [addExerciseSearch, setAddExerciseSearch] = useState('');
  const [showFinishSummary, setShowFinishSummary] = useState(false);

  useEffect(() => {
    if (params.templateId && params.dayId && params.dayName && !session) {
      const ids = (params.exerciseIds ?? '').split(',').filter(Boolean);
      const defaultSets =
        params.defaultSets != null ? parseInt(params.defaultSets, 10) : undefined;
      const sets = defaultSets != null && !Number.isNaN(defaultSets) && defaultSets > 0 ? defaultSets : undefined;
      startWorkout(params.templateId, params.dayId, params.dayName, ids, sets);
    }
  }, [params.templateId, params.dayId, params.dayName, params.exerciseIds, params.defaultSets, session, startWorkout]);

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

  // When timer expires (restSecondsLeft becomes null), save full duration and clear restAfter
  useEffect(() => {
    if (restSecondsLeft !== null || restAfter === null) return;
    setRestDurationsBetweenSets((prev) => ({
      ...prev,
      [`${restAfter.exIdx}-${restAfter.setIdx}`]: restTotalSeconds,
    }));
    setRestAfter(null);
    setShowRestControlSheet(false);
  }, [restSecondsLeft, restAfter, restTotalSeconds]);

  function startRest(exIdx: number, setIdx: number, totalSeconds = DEFAULT_REST_SECONDS) {
    setRestAfter({ exIdx, setIdx });
    setRestTotalSeconds(totalSeconds);
    setRestSecondsLeft(totalSeconds);
  }

  function startManualRest(seconds: number) {
    setShowRestPicker(false);
    setRestAfter(null);
    setRestTotalSeconds(seconds);
    setRestSecondsLeft(seconds);
  }

  function skipRest() {
    if (restAfter !== null && restTotalSeconds > 0 && restSecondsLeft !== null) {
      const taken = restTotalSeconds - restSecondsLeft;
      if (taken > 0) {
        setRestDurationsBetweenSets((prev) => ({
          ...prev,
          [`${restAfter.exIdx}-${restAfter.setIdx}`]: taken,
        }));
      }
    }
    setRestSecondsLeft(null);
    setRestAfter(null);
    setShowRestControlSheet(false);
  }

  function add30SecondsRest() {
    setRestTotalSeconds((t) => t + 30);
    setRestSecondsLeft((s) => (s === null ? null : s + 30));
  }

  function subtract30SecondsRest() {
    setRestTotalSeconds((t) => Math.max(30, t - 30));
    setRestSecondsLeft((s) => (s === null ? null : Math.max(30, s - 30)));
  }

  function resetRest() {
    setRestTotalSeconds(DEFAULT_REST_SECONDS);
    setRestSecondsLeft(DEFAULT_REST_SECONDS);
  }

  async function handleFinish(updateCustomTemplate?: boolean) {
    setShowFinishSummary(false);
    if (updateCustomTemplate && session) {
      const template = allTemplates().find((t) => t.id === session.templateId);
      if (template && !template.isBuiltIn) {
        const newDays = template.days.map((d) =>
          d.id === session!.dayId
            ? { ...d, exerciseIds: session!.exercises.map((e) => e.exerciseId) }
            : d
        );
        await updateTemplate(session.templateId, { days: newDays });
      }
    }
    await finishWorkout();
    router.replace('/(tabs)');
  }

  function handleSaveWorkoutPress() {
    if (!session) return;
    const template = allTemplates().find((t) => t.id === session.templateId);
    const isCustomTemplate = template && !template.isBuiltIn && session.templateId !== '_empty';
    if (isCustomTemplate) {
      Alert.alert(
        'Save workout',
        `Update template "${template!.name}" to match these exercises, or just save this workout?`,
        [
          { text: 'Just save workout', onPress: () => handleFinish(false) },
          { text: 'Update template', onPress: () => handleFinish(true) },
          { text: 'Cancel', style: 'cancel', onPress: () => {} },
        ]
      );
    } else {
      handleFinish(false);
    }
  }

  function handleCancel() {
    discardWorkout();
    router.replace('/(tabs)');
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color={colors.primary} />
          </Pressable>
          <Text style={[styles.elapsed, { color: colors.text }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentTemplate = allTemplates().find((t) => t.id === session.templateId);
  const isBuiltInWorkout = currentTemplate?.isBuiltIn === true;

  const hasAtLeastOneSet = session.exercises.some((ex) => ex.sets.some((s) => s.completed));
  const completedSetsByExercise = session.exercises.map((se) => ({
    name: getExercise(se.exerciseId)?.name ?? se.exerciseId,
    completed: se.sets.filter((s) => s.completed).length,
    total: se.sets.length,
    sets: se.sets.filter((s) => s.completed),
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header: Back + (Rest timer | Timer icon) | Time (center, absolute) | Finish */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color={colors.primary} />
          </Pressable>
          {restSecondsLeft !== null && restSecondsLeft > 0 ? (
            <Pressable
              onPress={() => setShowRestControlSheet(true)}
              style={[styles.headerRestContainer, { backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.headerRestTop}>
                <Ionicons name="timer-outline" size={14} color={colors.accent} />
                <Text style={[styles.headerRestTime, { color: colors.accent }]}>
                  {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowRestPicker(true)}
              hitSlop={8}
              style={[styles.headerTimerBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <Ionicons name="timer-outline" size={20} color={colors.accent} />
            </Pressable>
          )}
        </View>
        <View style={styles.headerCenter} pointerEvents="none">
          <Text style={[styles.elapsed, { color: colors.text }]}>{formatElapsed(elapsedMs)}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowFinishSummary(true)}
            disabled={!hasAtLeastOneSet}
            style={[styles.finishHeaderBtn, !hasAtLeastOneSet && styles.finishHeaderBtnDisabled]}
          >
            <Text style={[styles.finishHeaderText, { color: hasAtLeastOneSet ? colors.accent : colors.textMuted }]}>
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
        {session.exercises.length === 0 && (
          <View style={[styles.emptyWorkoutBlock, { backgroundColor: colors.surface }]}>
            <Text style={[styles.emptyWorkoutText, { color: colors.textSecondary }]}>
              No exercises yet. Tap Add Exercise below to build your workout.
            </Text>
          </View>
        )}
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
              <View style={styles.exerciseCardHeader}>
                <Text style={[styles.exerciseName, { color: colors.accent }]}>
                  {exercise?.name ?? se.exerciseId}
                  {exercise?.equipment?.[0] ? ` (${exercise.equipment[0].charAt(0).toUpperCase() + exercise.equipment[0].slice(1)})` : ''}
                </Text>
                <View style={styles.exerciseCardActions}>
                  <Pressable hitSlop={8} style={styles.exerciseHeaderIcon}>
                    <Ionicons name="link-outline" size={18} color={colors.accent} />
                  </Pressable>
                  {!isBuiltInWorkout && (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        Alert.alert(
                          'Remove exercise',
                          `Remove ${exercise?.name ?? se.exerciseId} from this workout?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removeExercise(exIdx) },
                          ]
                        );
                      }}
                      style={styles.exerciseHeaderIcon}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.thSet, { color: colors.textMuted }]}>SET</Text>
                <Text style={[styles.th, styles.thPrev, { color: colors.textMuted }]}>PREVIOUS</Text>
                <Text style={[styles.th, styles.thKg, { color: colors.textMuted }]}>{weightLabel}</Text>
                <Text style={[styles.th, styles.thReps, { color: colors.textMuted }]}>REPS</Text>
                <View style={styles.thActions} />
              </View>

              {se.sets.map((set, setIdx) => {
                const isKgFocused = focusedCell?.exIdx === exIdx && focusedCell?.setIdx === setIdx && focusedCell?.field === 'kg';
                const isRepsFocused = focusedCell?.exIdx === exIdx && focusedCell?.setIdx === setIdx && focusedCell?.field === 'reps';
                const prev = previousMap[se.exerciseId];
                const prevLabel = prev
                  ? `${kgToDisplay(prev.weightKg, weightUnit)} ${weightUnit}${prev.reps != null ? ` × ${prev.reps}` : ''}`
                  : '—';

                return (
                  <View key={setIdx}>
                    <SwipeableSetRow
                      canDelete={se.sets.length > 1}
                      onRemove={() => removeSet(exIdx, setIdx)}
                      dangerColor={colors.danger}
                    >
                      <View
                        style={[
                          styles.setRow,
                          {
                            backgroundColor: set.completed
                              ? 'rgba(34, 197, 94, 0.15)'
                              : colors.surface,
                          },
                        ]}
                      >
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
                              backgroundColor: isKgFocused ? colors.background : colors.surfaceElevated,
                              color: colors.text,
                              borderColor: isKgFocused ? colors.accent : 'transparent',
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
                              backgroundColor: isRepsFocused ? colors.background : colors.surfaceElevated,
                              color: colors.text,
                              borderColor: isRepsFocused ? colors.accent : 'transparent',
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
                              ? { backgroundColor: '#22c55e' }
                              : { backgroundColor: colors.surfaceElevated },
                          ]}
                          onPress={() => {
                            if (set.completed) {
                              uncompleteSet(exIdx, setIdx);
                            } else {
                              completeSet(exIdx, setIdx);
                              if (setIdx < se.sets.length - 1) startRest(exIdx, setIdx);
                            }
                          }}
                        >
                          <Text style={[styles.doneBtnText, { color: set.completed ? '#fff' : colors.textSecondary }]}>
                            ✓
                          </Text>
                        </Pressable>
                      </View>
                    </SwipeableSetRow>
                    {/* Rest between sets: active progress bar or static duration */}
                    {setIdx < se.sets.length - 1 && (
                      <View style={styles.restBetweenRow}>
                        {restAfter?.exIdx === exIdx && restAfter?.setIdx === setIdx && restSecondsLeft != null && restSecondsLeft > 0 ? (
                          <Pressable
                            style={[styles.restProgressBar, { backgroundColor: colors.accent }]}
                            onPress={() => setShowRestControlSheet(true)}
                          >
                            <View style={[styles.restProgressBarBg, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                              <View
                                style={[
                                  styles.restProgressBarFill,
                                  {
                                    width: `${restTotalSeconds > 0 ? ((restTotalSeconds - restSecondsLeft) / restTotalSeconds) * 100 : 0}%`,
                                    backgroundColor: colors.primary,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={[styles.restProgressBarTime, { color: '#fff' }]}>
                              {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text style={[styles.restBetweenText, { color: colors.accent }]}>
                            {restDurationsBetweenSets[`${exIdx}-${setIdx}`] != null
                              ? formatElapsed(restDurationsBetweenSets[`${exIdx}-${setIdx}`] * 1000)
                              : '2:00'}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {isBarbell && editingWeightExIdx === exIdx && (
                <PlateCalculator totalKg={currentWeightKg || 20} unit={weightUnit} />
              )}

              <Pressable
                style={[styles.addSetBtn, { borderColor: colors.border }]}
                onPress={() => addSet(exIdx)}
              >
                <Ionicons name="add" size={18} color={colors.accent} />
                <Text style={[styles.addSetBtnText, { color: colors.accent }]}>ADD SET (2:00)</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          style={[
            styles.addExerciseBtn,
            { backgroundColor: isPro ? colors.primary : colors.surfaceElevated, borderColor: colors.border },
          ]}
          onPress={() => {
            if (isPro) {
              setShowAddExerciseModal(true);
            } else {
              router.push('/subscription');
            }
          }}
        >
          <Ionicons name="add-circle-outline" size={22} color={isPro ? '#fff' : colors.textSecondary} />
          <Text style={[styles.addExerciseBtnText, { color: isPro ? '#fff' : colors.textSecondary }]}>
            {isPro ? 'Add Exercise' : 'Pro: Add Exercise'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.cancelWorkoutBtn}
          onPress={() => {
            Alert.alert(
              'Cancel workout',
              'This workout will not be saved. Are you sure?',
              [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel workout',
                  style: 'destructive',
                  onPress: () => {
                    useActiveWorkoutStore.getState().discardWorkout();
                    router.replace('/(tabs)');
                  },
                },
              ]
            );
          }}
        >
          <Text style={[styles.cancelWorkoutText, { color: colors.textMuted }]}>Cancel workout</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showRestPicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRestPicker(false)}>
          <View style={[styles.restPickerCard, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.restPickerTitle, { color: colors.text }]}>Start rest timer</Text>
            <View style={styles.restPickerOptions}>
              {[60, 120, 180].map((sec) => (
                <Pressable
                  key={sec}
                  style={[styles.restPickerOption, { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => startManualRest(sec)}
                >
                  <Text style={[styles.restPickerOptionText, { color: colors.accent }]}>
                    {sec === 60 ? '1 min' : sec === 120 ? '2 min' : '3 min'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setShowRestPicker(false)} style={styles.restPickerCancel}>
              <Text style={[styles.restPickerCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showRestControlSheet && restSecondsLeft != null} transparent animationType="slide">
        <Pressable style={styles.restControlOverlay} onPress={() => setShowRestControlSheet(false)}>
          <View
            style={[styles.restControlSheet, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.restControlSheetHandle, { backgroundColor: colors.textMuted }]} />
            <Text style={[styles.restControlLabel, { color: colors.textMuted }]}>Pause</Text>
            {restSecondsLeft != null && (
              <Text style={[styles.restControlTimer, { color: colors.text }]}>
                {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
              </Text>
            )}
            <View style={styles.restControlActions}>
              <Pressable
                style={[styles.restControlBtnCircle, { backgroundColor: colors.surfaceElevated }]}
                onPress={subtract30SecondsRest}
              >
                <Ionicons name="remove" size={24} color={colors.text} />
              </Pressable>
              <Pressable
                style={[styles.restControlBtnCircle, { backgroundColor: colors.surfaceElevated }]}
                onPress={add30SecondsRest}
              >
                <Ionicons name="add" size={24} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.restControlBottomActions}>
              <Pressable
                style={[styles.restControlBtnRect, { backgroundColor: colors.danger }]}
                onPress={resetRest}
              >
                <Text style={[styles.restControlBtnText, { color: '#fff' }]}>RESET</Text>
              </Pressable>
              <Pressable
                style={[styles.restControlBtnRect, { backgroundColor: colors.primary }]}
                onPress={skipRest}
              >
                <Text style={[styles.restControlBtnText, { color: '#fff' }]}>SKIP</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showFinishSummary} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFinishSummary(false)}>
          <View
            style={[styles.summaryCard, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Workout summary</Text>
            {session?.dayName && (
              <Text style={[styles.summaryDay, { color: colors.textSecondary }]}>{session.dayName}</Text>
            )}
            <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Duration</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatElapsed(elapsedMs)}</Text>
            </View>
            <View style={styles.summaryExercises}>
              <Text style={[styles.summarySectionLabel, { color: colors.textMuted }]}>Exercises</Text>
              {completedSetsByExercise
                .filter((ex) => ex.completed > 0)
                .map((item, idx) => (
                  <View key={idx} style={[styles.summaryExerciseRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.summaryExerciseName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.summaryExerciseSets, { color: colors.textSecondary }]}>
                      {item.completed} set{item.completed !== 1 ? 's' : ''}
                      {item.sets.some((s) => s.weightKg != null || s.reps != null)
                        ? ` · ${item.sets
                            .map((s) => {
                              const w = s.weightKg != null && s.weightKg > 0 ? kgToDisplay(s.weightKg, weightUnit) : '';
                              const r = s.reps != null ? `${s.reps} reps` : '';
                              return w && r ? `${w} × ${r}` : w || r || '—';
                            })
                            .join(', ')}`
                        : ''}
                    </Text>
                  </View>
                ))}
            </View>
            <View style={styles.summaryActions}>
              <Pressable
                style={[styles.summarySaveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveWorkoutPress}
              >
                <Text style={styles.summarySaveBtnText}>Save workout</Text>
              </Pressable>
              <Pressable onPress={() => setShowFinishSummary(false)} style={styles.summaryCancelBtn}>
                <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Back</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showAddExerciseModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddExerciseModal(false)}>
          <View
            style={[styles.addExerciseModalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.addExerciseModalHeader}>
              <Text style={[styles.addExerciseModalTitle, { color: colors.text }]}>Add exercise</Text>
              <Pressable onPress={() => setShowAddExerciseModal(false)}>
                <Text style={[styles.addExerciseModalClose, { color: colors.primary }]}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.addExerciseSearch,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textMuted}
              value={addExerciseSearch}
              onChangeText={setAddExerciseSearch}
            />
            <FlatList
              data={getAllExercises().filter(
                (e) =>
                  !addExerciseSearch.trim() ||
                  e.name.toLowerCase().includes(addExerciseSearch.trim().toLowerCase())
              )}
              keyExtractor={(item) => item.id}
              style={styles.addExerciseList}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.addExerciseRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (!session) return;
                    const template = allTemplates().find((t) => t.id === session.templateId);
                    const isBuiltIn = template?.isBuiltIn === true;
                    if (isBuiltIn) {
                      Alert.alert(
                        'Create custom workout',
                        'Adding an exercise to a built-in workout will create a custom copy. You can edit it later.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Continue',
                            onPress: () => {
                              const newDayId = 'day_' + Date.now();
                              const newTemplate = {
                                id: 'tpl_' + Date.now(),
                                name: (template?.name ?? session.dayName) + ' (Copy)',
                                days: [
                                  {
                                    id: newDayId,
                                    name: session.dayName,
                                    exerciseIds: [
                                      ...session.exercises.map((e) => e.exerciseId),
                                      item.id,
                                    ],
                                  },
                                ],
                                isBuiltIn: false as const,
                              };
                              addTemplate(newTemplate);
                              replaceTemplateAndAddExercise(
                                newTemplate.id,
                                newTemplate.days[0].id,
                                newTemplate.days[0].name,
                                item.id
                              );
                              setShowAddExerciseModal(false);
                              setAddExerciseSearch('');
                            },
                          },
                        ]
                      );
                    } else {
                      addExercise(item.id);
                      setShowAddExerciseModal(false);
                      setAddExerciseSearch('');
                    }
                  }}
                >
                  <Text style={[styles.addExerciseRowText, { color: colors.text }]}>{item.name}</Text>
                  <Ionicons name="add" size={20} color={colors.accent} />
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    position: 'relative',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 56 },
  headerTimerBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerRestContainer: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 56,
  },
  headerRestTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRestTime: { fontSize: 13, fontWeight: '700' },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 56 },
  elapsed: { fontSize: 20, fontWeight: '700' },
  finishHeaderBtn: { minWidth: 48, alignItems: 'flex-end' },
  finishHeaderBtnDisabled: { opacity: 0.7 },
  finishHeaderText: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 8, paddingVertical: 10, paddingBottom: 36 },
  emptyWorkoutBlock: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  emptyWorkoutText: { fontSize: 15, textAlign: 'center' },
  exerciseCard: {
    padding: 10,
    borderRadius: 16,
    marginBottom: 12,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseName: { fontSize: 16, fontWeight: '700', flex: 1 },
  exerciseCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseHeaderIcon: { padding: 6 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  th: { fontSize: 12, fontWeight: '600' },
  thSet: { width: 28, textAlign: 'center' },
  thPrev: { width: 80 },
  thKg: { flex: 1, minWidth: 56 },
  thReps: { flex: 1, minWidth: 56 },
  thActions: { width: 40 },
  swipeableContainer: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 4,
  },
  swipeableReveal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setLabel: { width: 28, fontSize: 14, textAlign: 'center' },
  prevCell: { width: 80, fontSize: 12 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  setInput: {
    flex: 1,
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  doneBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 18, fontWeight: '600' },
  restBetweenRow: {
    marginVertical: 2,
    alignItems: 'center',
    minHeight: 24,
    justifyContent: 'center',
  },
  restProgressBar: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  restProgressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  restProgressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  restProgressBarTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  restBetweenText: { fontSize: 13 },
  restControlOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  restControlSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  restControlSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  restControlLabel: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  restControlTimer: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  restControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  restControlBottomActions: {
    flexDirection: 'row',
    gap: 12,
  },
  restControlBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restControlBtnRect: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  restControlBtnText: { fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  restPickerCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24,
  },
  restPickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  restPickerOptions: { gap: 10, marginBottom: 16 },
  restPickerOption: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  restPickerOptionText: { fontSize: 16, fontWeight: '600' },
  restPickerCancel: { alignItems: 'center', padding: 8 },
  restPickerCancelText: { fontSize: 15 },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  addSetBtnText: { fontSize: 14, fontWeight: '600' },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
  },
  addExerciseBtnText: { fontSize: 17, fontWeight: '600' },
  addExerciseModalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  addExerciseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  addExerciseModalTitle: { fontSize: 20, fontWeight: '700' },
  addExerciseModalClose: { fontSize: 16, fontWeight: '600' },
  addExerciseSearch: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  addExerciseList: { maxHeight: 360 },
  addExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  addExerciseRowText: { fontSize: 16, fontWeight: '500' },
  summaryCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    alignSelf: 'center',
  },
  summaryTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  summaryDay: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 15, fontWeight: '600' },
  summaryExercises: { marginTop: 8, marginBottom: 20 },
  summarySectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  summaryExerciseRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryExerciseName: { fontSize: 16, fontWeight: '600' },
  summaryExerciseSets: { fontSize: 14, marginTop: 2 },
  summaryActions: { gap: 10 },
  summarySaveBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  summarySaveBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  summaryCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  summaryCancelText: { fontSize: 16 },
  cancelWorkoutBtn: {
    paddingVertical: 14,
    marginTop: 6,
    alignItems: 'center',
  },
  cancelWorkoutText: { fontSize: 15 },
});
