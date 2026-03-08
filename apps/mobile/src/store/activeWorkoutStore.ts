import { create } from 'zustand';
import type { WorkoutSession, SessionExercise, SetRecord } from '@muscleos/types';
import {
  getSessions,
  setSessions,
  getExercisePrevious,
  setExercisePrevious,
  type ExercisePrevious,
} from '@/storage/localStorage';
import { getRecovery, setRecovery } from '@/storage/localStorage';
import { getRecoveryHoursForMuscle, getRecoveryUntil } from '@muscleos/types';
import type { MuscleId } from '@muscleos/types';
import { useExercisesStore } from '@/store/exercisesStore';

const DEFAULT_SETS_PER_EXERCISE = 3;

export const DEFAULT_REST_SECONDS = 120;

export interface RestAfter {
  exIdx: number;
  setIdx: number;
}

export interface ActiveWorkoutState {
  session: WorkoutSession | null;
  /** Rest timer: end timestamp (ms) so it stays correct when app is backgrounded */
  restEndTime: number | null;
  restTotalSeconds: number;
  restAfter: RestAfter | null;
  /** Saved rest durations keyed by "exIdx-setIdx" for display after timer ends */
  restDurationsBetweenSets: Record<string, number>;
  startWorkout: (templateId: string, exerciseIds: string[], defaultSets?: number) => void;
  setSetRecord: (exerciseIndex: number, setIndex: number, record: Partial<SetRecord>) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (exerciseIndex: number) => void;
  moveExerciseUp: (exerciseIndex: number) => void;
  moveExerciseDown: (exerciseIndex: number) => void;
  /** Switch session to a new custom template and add an exercise (used when adding to built-in). */
  replaceTemplateAndAddExercise: (newTemplateId: string, exerciseId: string) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
  // Rest timer actions (in store so timer survives addSet/session updates)
  startRest: (exIdx: number, setIdx: number, totalSeconds?: number) => void;
  startManualRest: (seconds: number) => void;
  skipRest: () => void;
  add30SecondsRest: () => void;
  subtract30SecondsRest: () => void;
  resetRest: () => void;
  clearRestTimer: () => void;
  /** Record rest duration when timer completes or is skipped; merge into restDurationsBetweenSets */
  recordRestDuration: (exIdx: number, setIdx: number, seconds: number) => void;
}

function createEmptySession(
  templateId: string,
  exerciseIds: string[],
  defaultSets?: number
): WorkoutSession {
  const numSets = defaultSets ?? DEFAULT_SETS_PER_EXERCISE;
  const sets = Array.from({ length: numSets }, () => ({ completed: false }));
  return {
    id: 'session_' + Date.now(),
    templateId,
    startedAt: new Date().toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({
      exerciseId,
      sets: [...sets],
    })),
  };
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  session: null,
  restEndTime: null,
  restTotalSeconds: DEFAULT_REST_SECONDS,
  restAfter: null,
  restDurationsBetweenSets: {},

  startWorkout: (templateId, exerciseIds, defaultSets) => {
    if (get().session) return; // Only one workout at a time
    set({
      session: createEmptySession(templateId, exerciseIds, defaultSets),
    });
  },

  setSetRecord: (exerciseIndex, setIndex, record) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const sets = [...ex.sets];
    if (!sets[setIndex]) return;
    sets[setIndex] = { ...sets[setIndex], ...record };
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  completeSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const sets = [...ex.sets];
    if (!sets[setIndex]) return;
    sets[setIndex] = { ...sets[setIndex], completed: true };
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  uncompleteSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const sets = [...ex.sets];
    if (!sets[setIndex]) return;
    sets[setIndex] = { ...sets[setIndex], completed: false };
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  addSet: (exerciseIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    const lastSet = ex.sets[ex.sets.length - 1];
    const newSet = {
      completed: false,
      ...(lastSet?.weightKg != null && { weightKg: lastSet.weightKg }),
      ...(lastSet?.reps != null && { reps: lastSet.reps }),
    };
    exercises[exerciseIndex] = {
      ...ex,
      sets: [...ex.sets, newSet],
    };
    set({ session: { ...session, exercises } });
  },

  removeSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex || ex.sets.length <= 1) return;
    const sets = ex.sets.filter((_, i) => i !== setIndex);
    exercises[exerciseIndex] = { ...ex, sets };
    set({ session: { ...session, exercises } });
  },

  addExercise: (exerciseId) => {
    const { session } = get();
    if (!session) return;
    const newEx: SessionExercise = {
      exerciseId,
      sets: [{ completed: false }, { completed: false }, { completed: false }],
    };
    set({
      session: {
        ...session,
        exercises: [...session.exercises, newEx],
      },
    });
  },

  removeExercise: (exerciseIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = session.exercises.filter((_, i) => i !== exerciseIndex);
    set({ session: { ...session, exercises } });
  },

  moveExerciseUp: (exerciseIndex) => {
    const { session } = get();
    if (!session || exerciseIndex <= 0) return;
    const exercises = [...session.exercises];
    [exercises[exerciseIndex - 1], exercises[exerciseIndex]] = [exercises[exerciseIndex], exercises[exerciseIndex - 1]];
    set({ session: { ...session, exercises } });
  },

  moveExerciseDown: (exerciseIndex) => {
    const { session } = get();
    if (!session || exerciseIndex >= session.exercises.length - 1) return;
    const exercises = [...session.exercises];
    [exercises[exerciseIndex], exercises[exerciseIndex + 1]] = [exercises[exerciseIndex + 1], exercises[exerciseIndex]];
    set({ session: { ...session, exercises } });
  },

  replaceTemplateAndAddExercise: (newTemplateId, exerciseId) => {
    const { session } = get();
    if (!session) return;
    const newEx: SessionExercise = {
      exerciseId,
      sets: [{ completed: false }, { completed: false }, { completed: false }],
    };
    set({
      session: {
        ...session,
        templateId: newTemplateId,
        exercises: [...session.exercises, newEx],
      },
    });
  },

  finishWorkout: async () => {
    const { session } = get();
    if (!session) return;
    const completed: WorkoutSession = {
      ...session,
      completedAt: new Date().toISOString(),
    };
    const sessions = await getSessions();
    await setSessions([...sessions, completed]);

    // Update previous weight/reps per exercise (best set by weight, then reps)
    const prev = await getExercisePrevious();
    for (const se of completed.exercises) {
      const best = se.sets
        .filter((s) => s.weightKg != null && s.weightKg > 0)
        .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
      if (best) {
        prev[se.exerciseId] = {
          weightKg: best.weightKg!,
          reps: best.reps,
        };
      }
    }
    await setExercisePrevious(prev);

    // Update recovery: only muscles from exercises that had at least one completed set
    const muscleIds = new Set<MuscleId>();
    for (const se of completed.exercises) {
      const hasCompletedSet = se.sets.some((s) => s.completed);
      if (!hasCompletedSet) continue;
      const ex = useExercisesStore.getState().getExercise(se.exerciseId);
      if (ex) ex.muscles.forEach((m) => muscleIds.add(m));
    }
    const now = new Date();
    const recoveryList = await getRecovery();
    const newRecovery = Array.from(muscleIds).map((muscleId) => ({
      muscleId,
      trainedAt: session.startedAt,
    }));
    const nowIso = now.toISOString();
    const merged = [...recoveryList.filter((r) => getRecoveryUntil(r) > nowIso), ...newRecovery];
    await setRecovery(merged);

    set({
      session: null,
      restEndTime: null,
      restAfter: null,
      restDurationsBetweenSets: {},
    });
  },

  discardWorkout: () =>
    set({
      session: null,
      restEndTime: null,
      restAfter: null,
      restDurationsBetweenSets: {},
    }),

  startRest: (exIdx, setIdx, totalSeconds = DEFAULT_REST_SECONDS) => {
    set({
      restAfter: { exIdx, setIdx },
      restTotalSeconds: totalSeconds,
      restEndTime: Date.now() + totalSeconds * 1000,
    });
  },

  startManualRest: (seconds) => {
    set({
      restAfter: null,
      restTotalSeconds: seconds,
      restEndTime: Date.now() + seconds * 1000,
    });
  },

  skipRest: () => {
    const { restAfter, restTotalSeconds, restEndTime } = get();
    if (restAfter !== null && restTotalSeconds > 0 && restEndTime !== null) {
      const taken = Math.max(0, restTotalSeconds - Math.ceil((restEndTime - Date.now()) / 1000));
      if (taken > 0) {
        set((s) => ({
          restDurationsBetweenSets: {
            ...s.restDurationsBetweenSets,
            [`${restAfter.exIdx}-${restAfter.setIdx}`]: taken,
          },
        }));
      }
    }
    set({ restEndTime: null, restAfter: null });
  },

  add30SecondsRest: () => {
    const { restEndTime } = get();
    if (restEndTime === null) return;
    set((s) => ({
      restTotalSeconds: s.restTotalSeconds + 30,
      restEndTime: restEndTime + 30 * 1000,
    }));
  },

  subtract30SecondsRest: () => {
    const { restEndTime, restTotalSeconds } = get();
    if (restEndTime === null) return;
    const newTotal = Math.max(30, restTotalSeconds - 30);
    set({
      restTotalSeconds: newTotal,
      restEndTime: Math.max(Date.now() + 1000, restEndTime - 30 * 1000),
    });
  },

  resetRest: () => {
    set({
      restTotalSeconds: DEFAULT_REST_SECONDS,
      restEndTime: Date.now() + DEFAULT_REST_SECONDS * 1000,
    });
  },

  clearRestTimer: () => {
    set({ restEndTime: null, restAfter: null });
  },

  recordRestDuration: (exIdx, setIdx, seconds) => {
    set((s) => ({
      restDurationsBetweenSets: {
        ...s.restDurationsBetweenSets,
        [`${exIdx}-${setIdx}`]: seconds,
      },
    }));
  },
}));
