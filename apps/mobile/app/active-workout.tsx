import { useEffect, useState, useRef, type ReactNode } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { typography } from '@/theme/typography';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useActiveWorkoutStore, DEFAULT_REST_SECONDS } from '@/store/activeWorkoutStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { kgToDisplay, displayToKg } from '@/utils/weightUnits';
import { getExercisePrevious } from '@/storage/localStorage';
import { playWorkoutSound } from '@/utils/workoutSounds';
import { WorkoutConfetti } from '@/components/WorkoutConfetti';
import { MuscleDiagram } from '@/components/MuscleDiagram';
import { Ionicons } from '@expo/vector-icons';
import type { MuscleId, SessionExercise } from '@muscleos/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** e.g. 120 → "2:00" for compact labels */
function formatRestDurationLabel(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Shown in exercise menu → Rest timers; applies to every set in that exercise (including after the last). */
const REST_BETWEEN_SETS_CHOICES = [
  { label: '1:30', seconds: 90 },
  { label: '2:00', seconds: 120 },
  { label: '3:00', seconds: 180 },
] as const;

const REST_GAP_HEIGHT = 34;

function ExerciseMenuContent({
  isBuiltInWorkout,
  colors,
  onAddWarmUp,
  onEditRest,
  onRemove,
}: {
  isBuiltInWorkout: boolean;
  colors: { text: string; danger: string; border: string };
  onAddWarmUp: () => void;
  onEditRest: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <Pressable
        style={[styles.exerciseDropdownItem, styles.exerciseDropdownItemBorder, { borderBottomColor: colors.border }]}
        onPress={onAddWarmUp}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.text} />
        <Text style={[styles.exerciseDropdownItemText, { color: colors.text }]}>Add warm-up set</Text>
      </Pressable>
      <Pressable
        style={[
          styles.exerciseDropdownItem,
          !isBuiltInWorkout && styles.exerciseDropdownItemBorder,
          { borderBottomColor: colors.border },
        ]}
        onPress={onEditRest}
      >
        <Ionicons name="timer-outline" size={18} color={colors.text} />
        <Text style={[styles.exerciseDropdownItemText, { color: colors.text }]}>Edit rest timer</Text>
      </Pressable>
      {!isBuiltInWorkout ? (
        <Pressable style={styles.exerciseDropdownItem} onPress={onRemove}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.exerciseDropdownItemText, { color: colors.danger }]}>Remove exercise</Text>
        </Pressable>
      ) : null}
    </>
  );
}
const SET_COMPLETE_LAYOUT = LayoutAnimation.create(
  320,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

function SetDonePressable({
  completed,
  disabled,
  mutedFill,
  colors,
  onPress,
}: {
  completed: boolean;
  disabled?: boolean;
  mutedFill: string;
  colors: { primary: string; border: string; textMuted: string };
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    if (!completed) {
      LayoutAnimation.configureNext(SET_COMPLETE_LAYOUT);
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.12,
          friction: 5,
          tension: 280,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled && !completed ? 0.45 : 1 }}>
      <Pressable onPress={handlePress} disabled={disabled && !completed}>
        <View
          style={[
            styles.doneBtn,
            completed
              ? { backgroundColor: colors.primary }
              : { backgroundColor: mutedFill, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Ionicons name="checkmark" size={16} color={completed ? '#fff' : colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SetRowSwipeable({
  onDelete,
  dangerColor,
  children,
}: {
  onDelete: () => void;
  dangerColor: string;
  children: ReactNode;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const deletingRef = useRef(false);

  const handleDelete = () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
    swipeableRef.current?.close();
    onDelete();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      friction={2}
      rightThreshold={48}
      onSwipeableWillOpen={(direction) => {
        if (direction === 'right') handleDelete();
      }}
      renderRightActions={(progress) => (
        <View style={[styles.swipeDeleteAction, { backgroundColor: dangerColor }]}>
          <Animated.View style={{ opacity: progress }}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </Animated.View>
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

function ActiveRestGap({
  visible,
  restSecondsLeft,
  restTotalSeconds,
  colors,
  isDark,
}: {
  visible: boolean;
  restSecondsLeft: number;
  restTotalSeconds: number;
  colors: { primary: string; text: string; textMuted: string; border: string };
  isDark: boolean;
}) {
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        friction: 9,
        tension: 110,
        useNativeDriver: false,
      }).start();
      return;
    }
    if (!mounted) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, anim, mounted]);

  if (!mounted) return null;

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, REST_GAP_HEIGHT],
  });
  const progress =
    restTotalSeconds > 0
      ? Math.min(100, ((restTotalSeconds - restSecondsLeft) / restTotalSeconds) * 100)
      : 0;
  const timeLabel = `${Math.floor(restSecondsLeft / 60)}:${(restSecondsLeft % 60).toString().padStart(2, '0')}`;
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <Animated.View style={[styles.restGapBlock, { height, opacity: anim, overflow: 'hidden' }]}>
      <View style={styles.restGapInner}>
        <View style={styles.restGapTimeRow}>
          <Ionicons name="timer-outline" size={12} color={colors.primary} />
          <Text style={[styles.restGapTime, { color: colors.text }]}>{timeLabel}</Text>
          <Text style={[styles.restGapLabel, { color: colors.textMuted }]}>rest</Text>
        </View>
        <View style={[styles.restGapTrack, { backgroundColor: trackBg }]}>
          <View
            style={[
              styles.restGapFill,
              { width: `${progress}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

type FinishedSummary = {
  name: string;
  durationMs: number;
  muscleIds: MuscleId[];
  exercises: {
    name: string;
    completed: number;
    sets: { weightKg?: number; reps?: number }[];
  }[];
};

export default function ActiveWorkoutScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    templateId?: string;
    exerciseIds?: string;
    defaultSets?: string;
  }>();
  const session = useActiveWorkoutStore((s) => s.session);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const setSetRecord = useActiveWorkoutStore((s) => s.setSetRecord);
  const setExerciseRestBetweenSets = useActiveWorkoutStore((s) => s.setExerciseRestBetweenSets);
  const completeSet = useActiveWorkoutStore((s) => s.completeSet);
  const uncompleteSet = useActiveWorkoutStore((s) => s.uncompleteSet);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const addWarmUpSet = useActiveWorkoutStore((s) => s.addWarmUpSet);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const addExercise = useActiveWorkoutStore((s) => s.addExercise);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const reorderExercises = useActiveWorkoutStore((s) => s.reorderExercises);
  const replaceTemplateAndAddExercise = useActiveWorkoutStore((s) => s.replaceTemplateAndAddExercise);
  const finishWorkout = useActiveWorkoutStore((s) => s.finishWorkout);
  const restEndTime = useActiveWorkoutStore((s) => s.restEndTime);
  const restTotalSeconds = useActiveWorkoutStore((s) => s.restTotalSeconds);
  const restAfter = useActiveWorkoutStore((s) => s.restAfter);
  const restDurationsBetweenSets = useActiveWorkoutStore((s) => s.restDurationsBetweenSets);
  const startRest = useActiveWorkoutStore((s) => s.startRest);
  const startManualRest = useActiveWorkoutStore((s) => s.startManualRest);
  const skipRest = useActiveWorkoutStore((s) => s.skipRest);
  const add30SecondsRest = useActiveWorkoutStore((s) => s.add30SecondsRest);
  const subtract30SecondsRest = useActiveWorkoutStore((s) => s.subtract30SecondsRest);
  const clearRestTimer = useActiveWorkoutStore((s) => s.clearRestTimer);
  const recordRestDuration = useActiveWorkoutStore((s) => s.recordRestDuration);
  const subscriptionState = useSubscriptionStore((s) => s.state);
  const isPro = subscriptionState?.tier === 'pro' && (!subscriptionState?.expiresAt || new Date(subscriptionState.expiresAt) > new Date());
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const workoutSoundsEnabled = useSettingsStore((s) => s.workoutSoundsEnabled);
  const getExercise = useExercisesStore((s) => s.getExercise);
  const getAllExercises = useExercisesStore((s) => s.getAllExercises);
  const allTemplates = useTemplatesStore((s) => s.allTemplates);
  const addTemplate = useTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const weightLabel = weightUnit === 'lb' ? 'LB' : 'KG';

  // Rest timer state lives in store so it survives addSet/session updates
  const [restTick, setRestTick] = useState(0); // force re-render every second so derived restSecondsLeft updates
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [showRestControls, setShowRestControls] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // Derive remaining seconds from end time so timer is correct after returning from background
  const restSecondsLeft: number | null =
    restEndTime === null
      ? null
      : Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [editingWeightExIdx, setEditingWeightExIdx] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ exIdx: number; setIdx: number; field: 'kg' | 'reps' } | null>(null);
  const [previousMap, setPreviousMap] = useState<Record<string, { weightKg: number; reps?: number }>>({});
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [addExerciseSearch, setAddExerciseSearch] = useState('');
  const [showFinishSummary, setShowFinishSummary] = useState(false);
  const [exerciseMenuExIdx, setExerciseMenuExIdx] = useState<number | null>(null);
  const [dropdownLayout, setDropdownLayout] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const dropdownMeasureRef = useRef<View>(null);
  const menuAnchorRefs = useRef<Record<number, View | null>>({});
  const [restTimersExIdx, setRestTimersExIdx] = useState<number | null>(null);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<FinishedSummary | null>(null);

  const prevRestSecondsLeftRef = useRef<number | null>(null);
  /** Prevents re-starting a workout from URL params after finish/discard clears session. */
  const startedFromParamsRef = useRef(false);
  const leavingWorkoutRef = useRef(false);

  // Clear dropdown layout when menu closes so we re-measure next open
  useEffect(() => {
    if (exerciseMenuExIdx === null) setDropdownLayout(null);
  }, [exerciseMenuExIdx]);

  const closeExerciseMenu = () => {
    setExerciseMenuExIdx(null);
    setDropdownLayout(null);
  };

  const positionExerciseMenu = (exIdx: number) => {
    const anchor = menuAnchorRefs.current[exIdx];
    const dropdown = dropdownMeasureRef.current;
    if (!anchor || !dropdown) return;
    anchor.measureInWindow((bx, by, bw, bh) => {
      dropdown.measureInWindow((_, __, dw, dh) => {
        const screenWidth = Dimensions.get('window').width;
        const gap = 6;
        const top = by + bh + gap;
        const left = Math.max(8, Math.min(bx + bw - dw, screenWidth - dw - 8));
        setDropdownLayout({ top, left, width: dw, height: dh });
      });
    });
  };

  const toggleExerciseMenu = (exIdx: number) => {
    if (exerciseMenuExIdx === exIdx) {
      closeExerciseMenu();
      return;
    }
    setDropdownLayout(null);
    setExerciseMenuExIdx(exIdx);
  };

  useEffect(() => {
    if (!params.templateId || session || startedFromParamsRef.current || leavingWorkoutRef.current) {
      return;
    }
    startedFromParamsRef.current = true;
    const ids = (params.exerciseIds ?? '').split(',').filter(Boolean);
    const defaultSets =
      params.defaultSets != null ? parseInt(params.defaultSets, 10) : undefined;
    const sets = defaultSets != null && !Number.isNaN(defaultSets) && defaultSets > 0 ? defaultSets : undefined;
    startWorkout(params.templateId, ids, sets);
  }, [params.templateId, params.exerciseIds, params.defaultSets, session, startWorkout]);

  // Redirect to tabs when no session and no params to start one — but not after a successful finish (Good work page).
  const shouldRedirectToTabs = !session && !params.templateId && !finishedSummary;
  useEffect(() => {
    if (!shouldRedirectToTabs) return;
    const id = setTimeout(() => {
      router.replace('/(tabs)');
    }, 400);
    return () => clearTimeout(id);
  }, [shouldRedirectToTabs, router]);

  useEffect(() => {
    if (!session) return;
    getExercisePrevious().then((prev) => {
      setPreviousMap(prev);
      const current = useActiveWorkoutStore.getState().session;
      if (!current) return;
      current.exercises.forEach((se, exIdx) => {
        const p = prev[se.exerciseId];
        if (!p) return;
        se.sets.forEach((set, setIdx) => {
          if (set.weightKg == null && set.reps == null) {
            setSetRecord(exIdx, setIdx, { weightKg: p.weightKg, reps: p.reps });
          }
        });
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

  // Reset countdown tracking when rest is not active
  useEffect(() => {
    if (restEndTime === null) prevRestSecondsLeftRef.current = null;
  }, [restEndTime]);

  // Countdown ticks at 3, 2, 1 seconds remaining (ref tracks time even when sounds are off)
  useEffect(() => {
    if (restSecondsLeft == null) return;
    const prev = prevRestSecondsLeftRef.current;
    prevRestSecondsLeftRef.current = restSecondsLeft;
    if (!workoutSoundsEnabled) return;
    if (restSecondsLeft < 1 || restSecondsLeft > 3) return;
    if (prev !== null && restSecondsLeft >= prev) return;
    void playWorkoutSound('restTick');
  }, [restSecondsLeft, workoutSoundsEnabled, restTick]);

  // Tick every second while rest is active so UI updates; timer is time-based so correct when app was backgrounded
  useEffect(() => {
    if (restEndTime === null) return;
    const t = setInterval(() => setRestTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [restEndTime]);

  // When end time has passed, save duration and clear rest
  useEffect(() => {
    if (restEndTime === null || Date.now() < restEndTime) return;
    if (workoutSoundsEnabled) {
      void playWorkoutSound('restEnd');
    }
    if (restAfter !== null) {
      recordRestDuration(restAfter.exIdx, restAfter.setIdx, restTotalSeconds);
    }
    clearRestTimer();
  }, [
    restEndTime,
    restTick,
    restAfter,
    restTotalSeconds,
    workoutSoundsEnabled,
    recordRestDuration,
    clearRestTimer,
  ]);

  function handleStartManualRest(seconds: number) {
    setShowRestPicker(false);
    startManualRest(seconds);
  }

  function handleSkipRest() {
    skipRest();
    setShowRestControls(false);
  }

  // Close rest controls when rest ends
  useEffect(() => {
    if (restSecondsLeft == null || restSecondsLeft <= 0) {
      setShowRestControls(false);
    }
  }, [restSecondsLeft]);

  async function handleFinish(updateCustomTemplate?: boolean) {
    if (!session) return;
    setShowFinishSummary(false);
    setShowSaveAsTemplateModal(false);
    leavingWorkoutRef.current = true;

    const template = allTemplates().find((t) => t.id === session.templateId);
    if (updateCustomTemplate && template && !template.isBuiltIn) {
      await updateTemplate(session.templateId, {
        exerciseIds: session.exercises.map((e) => e.exerciseId),
      });
    }

    const muscleIdSet = new Set<MuscleId>();
    for (const se of session.exercises) {
      if (!se.sets.some((s) => s.completed)) continue;
      const exercise = getExercise(se.exerciseId);
      exercise?.muscles.forEach((m) => muscleIdSet.add(m));
    }

    const summary: FinishedSummary = {
      name: template?.name ?? (session.templateId === '_empty' ? 'Empty workout' : 'Workout'),
      durationMs: elapsedMs,
      muscleIds: [...muscleIdSet],
      exercises: session.exercises
        .map((se) => ({
          name: getExercise(se.exerciseId)?.name ?? se.exerciseId,
          completed: se.sets.filter((s) => s.completed).length,
          sets: se.sets.filter((s) => s.completed),
        }))
        .filter((ex) => ex.completed > 0),
    };

    if (workoutSoundsEnabled) {
      void playWorkoutSound('workoutComplete');
    }
    setFinishedSummary(summary);
    setShowConfetti(true);
    await finishWorkout();
  }

  function leaveFinishedWorkout() {
    router.replace('/(tabs)?discardWorkout=1');
  }

  function handleDiscardOnly() {
    setShowFinishSummary(false);
    setShowSaveAsTemplateModal(false);
    leavingWorkoutRef.current = true;
    // Clear on tabs mount so the resume pill never flashes
    router.replace('/(tabs)?discardWorkout=1');
  }

  async function handleSaveAsTemplate() {
    if (!session) return;
    const name = saveAsTemplateName.trim() || 'Workout';
    await addTemplate({
      id: 'tpl_' + Date.now(),
      name,
      exerciseIds: session.exercises.map((e) => e.exerciseId),
      isBuiltIn: false,
    });
    setSaveAsTemplateName('');
    await handleFinish(false);
  }

  function openSaveAsTemplateModal() {
    const dateLabel = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    setSaveAsTemplateName(`Workout ${dateLabel}`);
    setShowSaveAsTemplateModal(true);
  }

  function handleCancel() {
    leavingWorkoutRef.current = true;
    router.replace('/(tabs)?discardWorkout=1');
  }

  if (finishedSummary) {
    const totalSets = finishedSummary.exercises.reduce((n, ex) => n + ex.completed, 0);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <WorkoutConfetti visible={showConfetti} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.finishedScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.finishedHero}>
            <View style={[styles.finishedBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={28} color="#fff" />
            </View>
            <Text style={[styles.finishedTitle, { color: colors.text }]}>Good work</Text>
            <Text style={[styles.finishedSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {finishedSummary.name}
            </Text>
          </View>

          <View style={[styles.finishedStatsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatValue, { color: colors.text }]}>
                {formatElapsed(finishedSummary.durationMs)}
              </Text>
              <Text style={[styles.finishedStatLabel, { color: colors.textMuted }]}>Duration</Text>
            </View>
            <View style={[styles.finishedStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatValue, { color: colors.text }]}>
                {finishedSummary.exercises.length}
              </Text>
              <Text style={[styles.finishedStatLabel, { color: colors.textMuted }]}>Exercises</Text>
            </View>
            <View style={[styles.finishedStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.finishedStat}>
              <Text style={[styles.finishedStatValue, { color: colors.text }]}>{totalSets}</Text>
              <Text style={[styles.finishedStatLabel, { color: colors.textMuted }]}>Sets</Text>
            </View>
          </View>

          {finishedSummary.muscleIds.length > 0 ? (
            <View style={[styles.finishedDiagramCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.finishedSectionLabel, { color: colors.textMuted, marginBottom: 8 }]}>
                Muscles trained
              </Text>
              <MuscleDiagram
                muscleIds={finishedSummary.muscleIds}
                recoveringMuscleIds={finishedSummary.muscleIds}
                justTrainedMuscleIds={finishedSummary.muscleIds}
                size={0.72}
              />
            </View>
          ) : null}

          <Text style={[styles.finishedSectionLabel, { color: colors.textMuted }]}>Summary</Text>
          <View style={[styles.finishedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {finishedSummary.exercises.map((item, idx) => (
              <View
                key={`${item.name}-${idx}`}
                style={[
                  styles.finishedExerciseRow,
                  idx < finishedSummary.exercises.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={styles.finishedExerciseTop}>
                  <Text style={[styles.finishedExerciseName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.finishedExerciseSets, { color: colors.textSecondary }]}>
                    {item.completed} set{item.completed !== 1 ? 's' : ''}
                  </Text>
                </View>
                {item.sets.some((s) => s.weightKg != null || s.reps != null) ? (
                  <Text style={[styles.finishedExerciseDetail, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.sets
                      .map((s) => {
                        const w =
                          s.weightKg != null && s.weightKg > 0
                            ? `${kgToDisplay(s.weightKg, weightUnit)} ${weightUnit}`
                            : '';
                        const r = s.reps != null ? `${s.reps} reps` : '';
                        return w && r ? `${w} × ${r}` : w || r || '—';
                      })
                      .join('  ·  ')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.finishedFooter, { borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.finishedDoneBtn, { backgroundColor: colors.primary }]}
            onPress={leaveFinishedWorkout}
          >
            <Text style={styles.finishedDoneBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
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
  const isNoTemplateWorkout = session.templateId === '_empty';
  const templateExerciseIds = currentTemplate?.exerciseIds ?? [];
  const sessionExerciseIds = session.exercises.map((e) => e.exerciseId);
  const hasAddedExercises =
    currentTemplate &&
    !currentTemplate.isBuiltIn &&
    (sessionExerciseIds.length !== templateExerciseIds.length ||
      sessionExerciseIds.some((id, i) => templateExerciseIds[i] !== id));

  const hasAtLeastOneSet = session.exercises.some((ex) => ex.sets.some((s) => s.completed));
  const completedSetsByExercise = session.exercises.map((se) => ({
    name: getExercise(se.exerciseId)?.name ?? se.exerciseId,
    completed: se.sets.filter((s) => s.completed).length,
    total: se.sets.length,
    sets: se.sets.filter((s) => s.completed),
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header: Back + rest chip | Time | Done/Finish */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color={colors.primary} />
          </Pressable>
          {restSecondsLeft !== null && restSecondsLeft > 0 ? (
            <Pressable
              onPress={() => setShowRestControls(true)}
              hitSlop={6}
              style={[styles.headerRestChip, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="timer" size={13} color="#fff" />
              <Text style={styles.headerRestChipText}>
                {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowRestPicker(true)}
              hitSlop={8}
              style={[styles.headerTimerBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <Ionicons name="timer-outline" size={14} color={colors.primary} />
            </Pressable>
          )}
        </View>
        <View style={styles.headerCenter} pointerEvents="none">
          <Text style={[styles.elapsed, { color: colors.text }]}>{formatElapsed(elapsedMs)}</Text>
        </View>
        <View style={styles.headerRight}>
          {reorderMode ? (
            <Pressable
              onPress={() => setReorderMode(false)}
              hitSlop={8}
              style={styles.headerReorderBtn}
            >
              <Text style={[styles.headerReorderText, { color: colors.primary }]}>Done</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowFinishSummary(true)}
              disabled={!hasAtLeastOneSet}
              style={[
                styles.finishHeaderBtn,
                hasAtLeastOneSet && { backgroundColor: colors.primary },
                !hasAtLeastOneSet && styles.finishHeaderBtnDisabled,
              ]}
            >
              <Text
                style={[
                  styles.finishHeaderText,
                  { color: hasAtLeastOneSet ? '#fff' : colors.textMuted },
                ]}
              >
                Finish
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <DraggableFlatList
        data={session.exercises}
        keyExtractor={(item, index) => `${item.exerciseId}-${index}`}
        onDragEnd={({ from, to }) => {
          if (from !== to) reorderExercises(from, to);
        }}
        activationDistance={reorderMode ? 8 : 9999}
        containerStyle={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={2}>
              {currentTemplate?.name ??
                (isNoTemplateWorkout ? 'Empty workout' : 'Workout')}
            </Text>
            {reorderMode ? (
              <Text style={[styles.reorderHintInline, { color: colors.textMuted }]}>
                Hold and drag to rearrange
              </Text>
            ) : null}
            {session.exercises.length === 0 ? (
              <View style={[styles.emptyWorkoutBlock, { backgroundColor: colors.surface }]}>
                <Text style={[styles.emptyWorkoutText, { color: colors.textSecondary }]}>
                  No exercises yet. Tap Add Exercise below to build your workout.
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          reorderMode ? (
            <View style={{ height: 24 }} />
          ) : (
          <View>
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
                        leavingWorkoutRef.current = true;
                        router.replace('/(tabs)?discardWorkout=1');
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={[styles.cancelWorkoutText, { color: colors.textMuted }]}>Cancel workout</Text>
            </Pressable>
          </View>
          )
        }
        renderItem={({ item: se, getIndex, drag, isActive }: RenderItemParams<SessionExercise>) => {
          const exIdx = getIndex() ?? 0;
          const exercise = getExercise(se.exerciseId);

          if (reorderMode) {
            const completedCount = se.sets.filter((s) => s.completed).length;
            return (
              <ScaleDecorator>
                <Pressable
                  onLongPress={drag}
                  delayLongPress={120}
                  style={[
                    styles.reorderRow,
                    {
                      backgroundColor: isActive ? colors.surfaceElevated : colors.surface,
                      borderColor: colors.border,
                    },
                    isActive && styles.reorderRowActive,
                  ]}
                >
                  <Ionicons name="reorder-three" size={22} color={colors.textMuted} />
                  <Text style={[styles.reorderRowTitle, { color: colors.text }]} numberOfLines={1}>
                    {exercise?.name ?? se.exerciseId}
                  </Text>
                  <Text style={[styles.reorderRowMeta, { color: colors.textMuted }]}>
                    {completedCount}/{se.sets.length}
                  </Text>
                </Pressable>
              </ScaleDecorator>
            );
          }

          const restPresetSec = se.restBetweenSetsSeconds ?? DEFAULT_REST_SECONDS;

          return (
            <View
              style={[
                styles.exerciseCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !isDark && styles.exerciseCardShadow,
              ]}
            >
              <View style={styles.exerciseCardHeaderWrap}>
                <View style={styles.exerciseCardHeader}>
                  <Pressable
                    style={styles.exerciseTitlePressable}
                    onLongPress={() => {
                      if (session.exercises.length < 2) return;
                      setExerciseMenuExIdx(null);
                      setReorderMode(true);
                    }}
                    delayLongPress={280}
                  >
                    <View style={styles.exerciseTitleBlock}>
                      <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={2}>
                        {exercise?.name ?? se.exerciseId}
                      </Text>
                      {exercise?.equipment?.[0] ? (
                        <Text style={[styles.exerciseEquipment, { color: colors.textMuted }]}>
                          {exercise.equipment[0].charAt(0).toUpperCase() + exercise.equipment[0].slice(1)}
                        </Text>
                      ) : null}
                      <Pressable
                        onPress={() => setRestTimersExIdx(exIdx)}
                        hitSlop={4}
                        style={[
                          styles.exerciseRestChip,
                          {
                            backgroundColor: isDark ? 'rgba(196, 92, 38, 0.14)' : 'rgba(196, 92, 38, 0.08)',
                            borderColor: isDark ? 'rgba(196, 92, 38, 0.28)' : 'rgba(196, 92, 38, 0.18)',
                          },
                        ]}
                      >
                        <Ionicons name="timer-outline" size={11} color={colors.primary} />
                        <Text style={[styles.exerciseRestChipText, { color: colors.primary }]}>
                          {formatRestDurationLabel(restPresetSec)} rest
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                  <View style={styles.exerciseCardActions}>
                    <View
                      ref={(node) => {
                        menuAnchorRefs.current[exIdx] = node;
                      }}
                      collapsable={false}
                    >
                      <Pressable
                        hitSlop={8}
                        onPress={() => toggleExerciseMenu(exIdx)}
                        style={styles.exerciseHeaderIcon}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.tableInset,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                  },
                ]}
              >
              <View
                style={[
                  styles.tableHeaderStrip,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                    borderBottomColor: colors.border,
                  },
                ]}
              >
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.thSet, { color: colors.textMuted }]}>SET</Text>
                <Text style={[styles.th, styles.thPrev, { color: colors.textMuted }]}>PREVIOUS</Text>
                <Text style={[styles.th, styles.thKg, { color: colors.textMuted }]}>{weightLabel}</Text>
                <Text style={[styles.th, styles.thReps, { color: colors.textMuted }]}>REPS</Text>
                <View style={styles.thActions} />
              </View>
              </View>

              {se.sets.map((set, setIdx) => {
                const isKgFocused = focusedCell?.exIdx === exIdx && focusedCell?.setIdx === setIdx && focusedCell?.field === 'kg';
                const isRepsFocused = focusedCell?.exIdx === exIdx && focusedCell?.setIdx === setIdx && focusedCell?.field === 'reps';
                const firstIncompleteIdx = se.sets.findIndex((s) => !s.completed);
                const isFutureSet =
                  firstIncompleteIdx !== -1 && setIdx > firstIncompleteIdx && !set.completed;
                const isCurrentSet = firstIncompleteIdx === setIdx && !set.completed;
                const restDurationKey = `${exIdx}-${setIdx}`;
                const recordedRestSec = restDurationsBetweenSets[restDurationKey];
                const isActiveRestGap =
                  restAfter?.exIdx === exIdx &&
                  restAfter?.setIdx === setIdx &&
                  restSecondsLeft != null &&
                  restSecondsLeft > 0;

                const isWarmUp = set.isWarmUp === true;
                const warmUpNumber = isWarmUp
                  ? se.sets.slice(0, setIdx + 1).filter((s) => s.isWarmUp).length
                  : 0;
                const workingSetNumber = isWarmUp
                  ? 0
                  : se.sets.slice(0, setIdx + 1).filter((s) => !s.isWarmUp).length;
                const setLabelText = isWarmUp ? `W${warmUpNumber}` : String(workingSetNumber);

                const prev = previousMap[se.exerciseId];
                const prevLabel = prev
                  ? `${kgToDisplay(prev.weightKg, weightUnit)} ${weightUnit}${prev.reps != null ? ` × ${prev.reps}` : ''}`
                  : '—';

                const completedRowTint = isDark
                  ? 'rgba(20, 83, 45, 0.22)'
                  : '#f0fdf4';
                const warmUpRowTint = isDark ? 'rgba(255,255,255,0.04)' : '#faf8f6';
                const rowBg = set.completed
                  ? completedRowTint
                  : isWarmUp
                    ? warmUpRowTint
                    : isFutureSet
                      ? isDark
                        ? 'rgba(255,255,255,0.03)'
                        : '#f8fafc'
                      : isDark
                        ? colors.surface
                        : '#ffffff';
                const mutedFill = isDark ? colors.surfaceElevated : '#f1f5f9';

                let kgBorderW = 0;
                let kgBorderColor = 'transparent';
                let repsBorderW = 0;
                let repsBorderColor = 'transparent';
                let kgFill: string = colors.surface;
                let repsFill: string = mutedFill;

                if (!set.completed) {
                  if (isFutureSet) {
                    kgFill = mutedFill;
                    repsFill = mutedFill;
                  } else if (isCurrentSet) {
                    if (isKgFocused) {
                      kgFill = colors.surface;
                      kgBorderW = 1.5;
                      kgBorderColor = colors.accent;
                      repsFill = mutedFill;
                    } else if (isRepsFocused) {
                      kgFill = mutedFill;
                      repsFill = colors.surface;
                      repsBorderW = 1.5;
                      repsBorderColor = colors.accent;
                    } else {
                      kgFill = colors.surface;
                      kgBorderW = 1;
                      kgBorderColor = isDark ? colors.border : '#cbd5e1';
                      repsFill = mutedFill;
                    }
                  }
                }

                const weightStr =
                  set.weightKg !== undefined ? String(kgToDisplay(set.weightKg, weightUnit)) : '—';
                const repsStr = set.reps !== undefined ? String(set.reps) : '—';
                const canDeleteSet = se.sets.length > 1;

                const setRow = (
                    <View
                      style={[
                        styles.setRow,
                        {
                          backgroundColor: rowBg,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.setLabelWrap}>
                        <Text
                          style={[
                            styles.setLabel,
                            isWarmUp && styles.setLabelWarmUp,
                            {
                              color: set.completed
                                ? colors.text
                                : isWarmUp
                                  ? colors.textSecondary
                                  : isFutureSet
                                    ? colors.textMuted
                                    : colors.text,
                              fontWeight: '600',
                            },
                          ]}
                        >
                          {setLabelText}
                        </Text>
                        {set.completed && recordedRestSec != null ? (
                          <Text style={[styles.setRestDuration, { color: colors.textMuted }]}>
                            {formatElapsed(recordedRestSec * 1000)}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.prevCell, { color: colors.textMuted }]} numberOfLines={1}>
                        {prevLabel}
                      </Text>
                      {set.completed ? (
                        <>
                          <Text style={[styles.setCellText, { color: colors.text }]}>{weightStr}</Text>
                          <Text style={[styles.setCellText, { color: colors.text }]}>{repsStr}</Text>
                        </>
                      ) : (
                        <>
                          <TextInput
                            style={[
                              styles.setInput,
                              {
                                backgroundColor: kgFill,
                                color: colors.text,
                                borderColor: kgBorderColor,
                                borderWidth: kgBorderW,
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
                                backgroundColor: repsFill,
                                color: colors.text,
                                borderColor: repsBorderColor,
                                borderWidth: repsBorderW,
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
                        </>
                      )}
                      <SetDonePressable
                        completed={set.completed}
                        disabled={!set.completed && !(set.reps != null && set.reps > 0)}
                        mutedFill={mutedFill}
                        colors={colors}
                        onPress={() => {
                          if (set.completed) {
                            uncompleteSet(exIdx, setIdx);
                            if (restAfter?.exIdx === exIdx && restAfter?.setIdx === setIdx) {
                              clearRestTimer();
                            }
                          } else {
                            if (!(set.reps != null && set.reps > 0)) return;
                            completeSet(exIdx, setIdx);
                            if (workoutSoundsEnabled) {
                              void playWorkoutSound('setComplete');
                            }
                            startRest(
                              exIdx,
                              setIdx,
                              se.restBetweenSetsSeconds ?? DEFAULT_REST_SECONDS
                            );
                          }
                        }}
                      />
                    </View>
                );

                return (
                  <View key={setIdx}>
                    {canDeleteSet ? (
                      <SetRowSwipeable
                        dangerColor={colors.danger}
                        onDelete={() => {
                          if (restAfter?.exIdx === exIdx && restAfter?.setIdx === setIdx) {
                            clearRestTimer();
                          }
                          removeSet(exIdx, setIdx);
                        }}
                      >
                        {setRow}
                      </SetRowSwipeable>
                    ) : (
                      setRow
                    )}
                    <ActiveRestGap
                      visible={isActiveRestGap}
                      restSecondsLeft={restSecondsLeft ?? 0}
                      restTotalSeconds={restTotalSeconds}
                      colors={colors}
                      isDark={isDark}
                    />
                  </View>
                );
              })}

              <Pressable
                style={[styles.addSetBtn, { borderColor: colors.accent }]}
                onPress={() => addSet(exIdx)}
              >
                <Text style={[styles.addSetBtnText, { color: colors.accent }]}>
                  + ADD SET ({formatRestDurationLabel(restPresetSec)})
                </Text>
              </Pressable>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={showRestPicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRestPicker(false)}>
          <View
            style={[styles.restPickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.restPickerTitle, { color: colors.text }]}>Start rest</Text>
            <Text style={[styles.restPickerHint, { color: colors.textMuted }]}>
              Quick timer — tap a duration
            </Text>
            <View style={styles.restPickerOptions}>
              {[60, 120, 180].map((sec) => (
                <Pressable
                  key={sec}
                  style={[styles.restPickerOption, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => handleStartManualRest(sec)}
                >
                  <Text style={[styles.restPickerOptionText, { color: colors.primary }]}>
                    {sec === 60 ? '1:00' : sec === 120 ? '2:00' : '3:00'}
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

      {/* Hidden dropdown for sizing; positioned from ellipsis anchor */}
      {exerciseMenuExIdx !== null && session?.exercises[exerciseMenuExIdx] && (
        <View
          ref={dropdownMeasureRef}
          style={[
            styles.exerciseDropdown,
            styles.exerciseDropdownMeasure,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
          pointerEvents="none"
          onLayout={() => {
            if (exerciseMenuExIdx != null) positionExerciseMenu(exerciseMenuExIdx);
          }}
          collapsable={false}
        >
          <ExerciseMenuContent
            isBuiltInWorkout={isBuiltInWorkout}
            colors={colors}
            onAddWarmUp={() => {}}
            onEditRest={() => {}}
            onRemove={() => {}}
          />
        </View>
      )}

      {/* Exercise dropdown overlay: tap outside to close */}
      {dropdownLayout !== null && exerciseMenuExIdx !== null && session && (() => {
        const exIdx = exerciseMenuExIdx;
        const se = session.exercises[exIdx];
        const exercise = se ? getExercise(se.exerciseId) : null;
        return (
          <Modal visible transparent animationType="none">
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closeExerciseMenu}
              />
              <View
                style={[
                  styles.exerciseDropdown,
                  {
                    position: 'absolute',
                    left: dropdownLayout.left,
                    top: dropdownLayout.top,
                    width: dropdownLayout.width,
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onStartShouldSetResponder={() => true}
              >
                <ExerciseMenuContent
                  isBuiltInWorkout={isBuiltInWorkout}
                  colors={colors}
                  onAddWarmUp={() => {
                    addWarmUpSet(exIdx);
                    closeExerciseMenu();
                  }}
                  onEditRest={() => {
                    setRestTimersExIdx(exIdx);
                    closeExerciseMenu();
                  }}
                  onRemove={() => {
                    closeExerciseMenu();
                    Alert.alert(
                      'Remove exercise',
                      `Remove ${exercise?.name ?? se.exerciseId} from this workout?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeExercise(exIdx) },
                      ]
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
        );
      })()}

      <Modal visible={showRestControls && restSecondsLeft != null && restSecondsLeft > 0} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRestControls(false)}>
          <View
            style={[styles.restControlsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.restControlsBadge, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="timer" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.restControlsLabel, { color: colors.textMuted }]}>Rest remaining</Text>
            {restSecondsLeft != null && (
              <Text style={[styles.restControlsTimer, { color: colors.text }]}>
                {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
              </Text>
            )}
            <View style={styles.restControlsRow}>
              <Pressable
                style={[styles.restControlsAdj, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={subtract30SecondsRest}
              >
                <Text style={[styles.restControlsAdjText, { color: colors.text }]}>−30</Text>
              </Pressable>
              <Pressable
                style={[styles.restControlsAdj, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={add30SecondsRest}
              >
                <Text style={[styles.restControlsAdjText, { color: colors.text }]}>+30</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.restControlsSkip, { backgroundColor: colors.primary }]}
              onPress={handleSkipRest}
            >
              <Text style={styles.restControlsSkipText}>Skip rest</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Rest after each set for this exercise */}
      <Modal visible={restTimersExIdx !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setRestTimersExIdx(null)}>
          <View
            style={[styles.restTimersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            {restTimersExIdx !== null && session?.exercises[restTimersExIdx] && (() => {
              const ex = session.exercises[restTimersExIdx];
              const exerciseName = getExercise(ex.exerciseId)?.name ?? ex.exerciseId;
              const effectiveSeconds = ex.restBetweenSetsSeconds ?? DEFAULT_REST_SECONDS;
              return (
                <>
                  <Text style={[styles.restTimersTitle, { color: colors.text }]}>Edit rest timer</Text>
                  <Text style={[styles.restTimersSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                    {exerciseName}
                  </Text>
                  <Text style={[styles.restTimersHint, { color: colors.textMuted }]}>
                    Used after every set in this exercise, including the last set.
                  </Text>
                  <View style={styles.restTimersOptions}>
                    {REST_BETWEEN_SETS_CHOICES.map((opt) => {
                      const selected = effectiveSeconds === opt.seconds;
                      return (
                        <Pressable
                          key={opt.seconds}
                          style={[
                            styles.restTimerChoiceBtn,
                            {
                              backgroundColor: selected ? colors.primary : colors.surfaceElevated,
                              borderColor: selected ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => {
                            setExerciseRestBetweenSets(restTimersExIdx, opt.seconds);
                            setRestTimersExIdx(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.restTimerChoiceBtnText,
                              { color: selected ? '#fff' : colors.text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    style={[styles.restTimersDoneBtn, { borderColor: colors.border }]}
                    onPress={() => setRestTimersExIdx(null)}
                  >
                    <Text style={[styles.restTimersDoneBtnText, { color: colors.text }]}>Cancel</Text>
                  </Pressable>
                </>
              );
            })()}
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
            {currentTemplate?.name && (
              <Text style={[styles.summaryDay, { color: colors.textSecondary }]}>{currentTemplate.name}</Text>
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
              {isBuiltInWorkout ? (
                <>
                  <Pressable
                    style={[styles.summarySaveBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleFinish(false)}
                  >
                    <Text style={styles.summarySaveBtnText}>Save values</Text>
                  </Pressable>
                  <Pressable onPress={handleDiscardOnly} style={[styles.summaryCancelBtn, { marginTop: 4 }]}>
                    <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Discard workout</Text>
                  </Pressable>
                </>
              ) : isNoTemplateWorkout ? (
                <>
                  <Pressable
                    style={[styles.summarySaveBtn, { backgroundColor: colors.primary }]}
                    onPress={openSaveAsTemplateModal}
                  >
                    <Text style={styles.summarySaveBtnText}>Save as template</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.summarySaveBtn, styles.summarySecondaryBtn, { borderColor: colors.border }]}
                    onPress={() => handleFinish(false)}
                  >
                    <Text style={[styles.summarySecondaryBtnText, { color: colors.text }]}>Save values only</Text>
                  </Pressable>
                  <Pressable onPress={handleDiscardOnly} style={[styles.summaryCancelBtn, { marginTop: 4 }]}>
                    <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Discard workout</Text>
                  </Pressable>
                </>
              ) : hasAddedExercises ? (
                <>
                  <Pressable
                    style={[styles.summarySaveBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleFinish(false)}
                  >
                    <Text style={styles.summarySaveBtnText}>Save values only</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.summarySaveBtn, styles.summarySecondaryBtn, { borderColor: colors.border }]}
                    onPress={() => handleFinish(true)}
                  >
                    <Text style={[styles.summarySecondaryBtnText, { color: colors.text }]}>
                      Save values and template
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleDiscardOnly} style={[styles.summaryCancelBtn, { marginTop: 4 }]}>
                    <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Discard workout</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.summarySaveBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleFinish(false)}
                  >
                    <Text style={styles.summarySaveBtnText}>Save values</Text>
                  </Pressable>
                  <Pressable onPress={handleDiscardOnly} style={[styles.summaryCancelBtn, { marginTop: 4 }]}>
                    <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Discard workout</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setShowFinishSummary(false)} style={styles.summaryCancelBtn}>
                <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Back</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showSaveAsTemplateModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSaveAsTemplateModal(false)}>
          <View
            style={[styles.summaryCard, styles.saveAsTemplateCard, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Save as template</Text>
            <Text style={[styles.summaryDay, { color: colors.textSecondary }]}>
              Name this workout to use it again later.
            </Text>
            <TextInput
              style={[
                styles.saveAsTemplateInput,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Template name"
              placeholderTextColor={colors.textMuted}
              value={saveAsTemplateName}
              onChangeText={setSaveAsTemplateName}
              autoFocus
            />
            <View style={styles.summaryActions}>
              <Pressable
                style={[styles.summarySaveBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleSaveAsTemplate()}
              >
                <Text style={styles.summarySaveBtnText}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setShowSaveAsTemplateModal(false)} style={styles.summaryCancelBtn}>
                <Text style={[styles.summaryCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showAddExerciseModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddExerciseModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.addExerciseKeyboardAvoid}
            keyboardVerticalOffset={0}
          >
            <View
              style={[styles.addExerciseModalContent, { backgroundColor: colors.surface }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.addExerciseModalHeader}>
                <Text style={[styles.addExerciseModalTitle, { color: colors.text }]}>Add exercise</Text>
                <Pressable onPress={() => setShowAddExerciseModal(false)}>
                  <Text style={[styles.addExerciseModalClose, { color: colors.accent }]}>Done</Text>
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
                keyboardShouldPersistTaps="handled"
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
                              const newTemplate = {
                                id: 'tpl_' + Date.now(),
                                name: (template?.name ?? 'Workout') + ' (Copy)',
                                exerciseIds: [
                                  ...session.exercises.map((e) => e.exerciseId),
                                  item.id,
                                ],
                                isBuiltIn: false as const,
                              };
                              addTemplate(newTemplate);
                              replaceTemplateAndAddExercise(newTemplate.id, item.id);
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
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    position: 'relative',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 56 },
  headerTimerBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    minHeight: 28,
  },
  headerRestChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: typography.data.fontFamily,
    fontWeight: '600',
  },
  headerRestContainer: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 48,
    minHeight: 24,
    justifyContent: 'center',
  },
  headerRestTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerRestTime: { fontSize: 12, fontFamily: typography.data.fontFamily, fontWeight: '600' },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 72 },
  elapsed: { ...typography.dataLarge, fontSize: 17 },
  finishHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  finishHeaderBtnDisabled: { opacity: 0.55 },
  finishHeaderText: { fontSize: 14, fontFamily: typography.button.fontFamily },
  workoutTitle: {
    ...typography.screenTitle,
    fontSize: 22,
    marginBottom: 10,
    marginTop: 4,
  },
  reorderHintInline: {
    ...typography.caption,
    marginBottom: 10,
  },
  restControlsCard: {
    marginHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  restControlsBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restControlsLabel: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  restControlsTimer: {
    ...typography.dataLarge,
    fontSize: 44,
  },
  restControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  restControlsAdj: {
    minWidth: 88,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  restControlsAdjText: {
    ...typography.data,
    fontSize: 16,
  },
  restControlsSkip: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  restControlsSkipText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: typography.button.fontFamily,
  },
  swipeDeleteAction: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 8, paddingVertical: 6, paddingBottom: 28 },
  emptyWorkoutBlock: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  emptyWorkoutText: { fontSize: 15, textAlign: 'center' },
  exerciseCard: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'visible',
    borderWidth: 1,
  },
  exerciseCardShadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  exerciseCardHeaderWrap: {
    position: 'relative',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  exerciseTitlePressable: {
    flex: 1,
  },
  exerciseTitleBlock: {
    gap: 3,
  },
  restBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  restBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  restBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  restBannerTime: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restBannerAdj: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  restBannerAdjText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  restBannerSkip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  restBannerSkipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  headerReorderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerReorderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reorderHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reorderHintText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reorderRowActive: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  reorderRowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  reorderRowMeta: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  exerciseName: {
    ...typography.sectionTitle,
    fontSize: 16,
    lineHeight: 21,
  },
  exerciseEquipment: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
  },
  exerciseRestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  exerciseRestChipText: {
    fontFamily: typography.data.fontFamily,
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseHeaderIcon: { padding: 4, marginTop: 1 },
  tableInset: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableHeaderStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
  },
  th: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  thSet: { width: 24, textAlign: 'center' },
  thPrev: { flex: 1, minWidth: 64, textAlign: 'center' },
  thKg: { flex: 1, minWidth: 48, textAlign: 'center' },
  thReps: { flex: 1, minWidth: 48, textAlign: 'center' },
  thActions: { width: 30 },
  setLabelWrap: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setLabel: { fontSize: 13, textAlign: 'center' },
  setLabelWarmUp: { fontSize: 11 },
  setRestDuration: {
    fontSize: 9,
    fontFamily: typography.data.fontFamily,
    textAlign: 'center',
    marginTop: 1,
  },
  prevCell: { flex: 1, minWidth: 56, fontSize: 9, textAlign: 'center' },
  setCellText: {
    flex: 1,
    minWidth: 44,
    fontSize: 14,
    fontFamily: typography.data.fontFamily,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 32,
  },
  setInput: {
    flex: 1,
    minWidth: 44,
    minHeight: 30,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRadius: 6,
    fontSize: 14,
    fontFamily: typography.data.fontFamily,
    fontWeight: '500',
    textAlign: 'center',
    overflow: 'hidden',
  },
  doneBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restGapBlock: {
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 2,
  },
  restGapInner: {
    gap: 5,
  },
  restGapTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  restGapTime: {
    fontFamily: typography.data.fontFamily,
    fontSize: 12,
    fontWeight: '600',
  },
  restGapLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  restGapTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  restGapFill: {
    height: '100%',
    borderRadius: 2,
  },
  restGapIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: '100%',
  },
  restIdleLine: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.9 },
  restBetweenText: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
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
    borderWidth: 1,
    padding: 24,
  },
  restPickerTitle: { ...typography.sectionTitle, marginBottom: 4, textAlign: 'center' },
  restPickerHint: { ...typography.caption, marginBottom: 16, textAlign: 'center' },
  restPickerOptions: { gap: 10, marginBottom: 16 },
  restPickerOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  restPickerOptionText: { ...typography.dataLarge, fontSize: 20 },
  restPickerCancel: { alignItems: 'center', padding: 8 },
  restPickerCancelText: { ...typography.caption },
  exerciseDropdown: {
    minWidth: 200,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 5,
  },
  exerciseDropdownMeasure: {
    position: 'absolute',
    opacity: 0,
    left: -10000,
    top: 0,
  },
  exerciseDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  exerciseDropdownItemBorder: {
    borderBottomWidth: 1,
  },
  exerciseDropdownItemText: { fontSize: 15 },
  editSetsCard: {
    width: '100%',
    maxWidth: 320,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
  },
  editSetsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  editSetsSubtitle: { fontSize: 14, marginBottom: 8 },
  editSetsHint: { fontSize: 13, marginBottom: 12 },
  editSetsList: { maxHeight: 240, marginBottom: 16 },
  editSetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  editSetsCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSetsRowLabel: { fontSize: 16 },
  editSetsActions: { gap: 10 },
  editSetsDeleteBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editSetsDeleteBtnText: { fontSize: 16, fontWeight: '600' },
  editSetsDoneBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  editSetsDoneBtnText: { fontSize: 16, fontWeight: '600' },
  restTimersCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  restTimersTitle: { ...typography.sectionTitle, marginBottom: 4 },
  restTimersSubtitle: { ...typography.caption, marginBottom: 6 },
  restTimersHint: { ...typography.caption, marginBottom: 16 },
  restTimersOptions: { gap: 10, marginBottom: 16 },
  restTimerChoiceBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  restTimerChoiceBtnText: { ...typography.data, fontSize: 17 },
  restTimersDoneBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  restTimersDoneBtnText: { ...typography.button },
  addSetBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 6,
    marginBottom: 6,
    marginTop: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  addSetBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
  },
  addExerciseBtnText: { fontSize: 15, fontWeight: '600' },
  addExerciseKeyboardAvoid: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  addExerciseModalContent: {
    flex: 1,
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
  addExerciseList: { flex: 1, minHeight: 0, maxHeight: 360 },
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
  summaryValue: { ...typography.data, fontFamily: typography.data.fontFamily },
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
  summarySecondaryBtn: { backgroundColor: 'transparent', borderWidth: 2 },
  summarySecondaryBtnText: { fontSize: 17, fontWeight: '600' },
  summaryCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  summaryCancelText: { fontSize: 16 },
  saveAsTemplateCard: { minWidth: 280 },
  saveAsTemplateInput: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 20,
  },
  cancelWorkoutBtn: {
    paddingVertical: 14,
    marginTop: 6,
    alignItems: 'center',
  },
  cancelWorkoutText: { fontSize: 15 },
  finishedScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  finishedHero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  finishedBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  finishedTitle: {
    ...typography.screenTitle,
    marginBottom: 6,
  },
  finishedSubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  finishedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    marginBottom: 22,
  },
  finishedStat: {
    flex: 1,
    alignItems: 'center',
  },
  finishedStatValue: {
    ...typography.dataLarge,
    marginBottom: 2,
  },
  finishedStatLabel: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
  },
  finishedStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  finishedSectionLabel: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  finishedDiagramCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 22,
    alignItems: 'center',
  },
  finishedCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  finishedExerciseRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  finishedExerciseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  finishedExerciseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  finishedExerciseSets: {
    fontSize: 13,
    fontWeight: '600',
  },
  finishedExerciseDetail: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  finishedFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  finishedDoneBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finishedDoneBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
