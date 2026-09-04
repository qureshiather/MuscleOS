import { AppState } from 'react-native';
import { create } from 'zustand';
import type { WorkoutSession, SessionExercise, SetRecord } from '@muscleos/types';
import {
  getSessions,
  setSessions,
  getExercisePrevious,
  setExercisePrevious,
  getActiveWorkout,
  setActiveWorkout,
} from '@/storage/localStorage';
import { getRecovery, setRecovery } from '@/storage/localStorage';
import { getRecoveryUntil } from '@/utils/recovery';
import type { MuscleId } from '@muscleos/types';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import {
  notifySessionUpsert,
  notifyRecoverySnapshot,
  notifyExercisePreviousSnapshot,
  syncAfterWorkout,
} from '@/sync';

const DEFAULT_SETS_PER_EXERCISE = 3;

export const DEFAULT_REST_SECONDS = 120;

export interface RestAfter {
  exIdx: number;
  setIdx: number;
}

function restKey(exIdx: number, setIdx: number): string {
  return `${exIdx}-${setIdx}`;
}

/** Remap "exIdx-setIdx" rest duration keys after exercises move. */
function remapRestDurations(
  durations: Record<string, number>,
  oldToNew: number[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(durations)) {
    const [exStr, setStr] = key.split('-');
    const oldEx = parseInt(exStr, 10);
    const setIdx = parseInt(setStr, 10);
    if (Number.isNaN(oldEx) || Number.isNaN(setIdx)) continue;
    const newEx = oldToNew[oldEx];
    if (newEx == null) continue;
    next[restKey(newEx, setIdx)] = seconds;
  }
  return next;
}

function remapRestAfter(restAfter: RestAfter | null, oldToNew: number[]): RestAfter | null {
  if (!restAfter) return null;
  const newEx = oldToNew[restAfter.exIdx];
  if (newEx == null) return null;
  return { exIdx: newEx, setIdx: restAfter.setIdx };
}

export interface ActiveWorkoutState {
  session: WorkoutSession | null;
  /** False until the persisted workout has been read back, so screens don't bounce early. */
  hydrated: boolean;
  /** Rest timer: end timestamp (ms) so it stays correct when app is backgrounded */
  restEndTime: number | null;
  restTotalSeconds: number;
  restAfter: RestAfter | null;
  /** Saved rest durations keyed by "exIdx-setIdx" for display after timer ends */
  restDurationsBetweenSets: Record<string, number>;
  startWorkout: (templateId: string, exerciseIds: string[], defaultSets?: number) => void;
  setSetRecord: (exerciseIndex: number, setIndex: number, record: Partial<SetRecord>) => void;
  /** Applies to all rests for this exercise (after each set, including the last). */
  setExerciseRestBetweenSets: (exerciseIndex: number, seconds: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  /** Inserts a warm-up set at the start of the exercise. */
  addWarmUpSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  addExercise: (exerciseId: string) => void;
  /** Swap the exercise at index; sets, rest, and warm-ups stay in place. */
  replaceExercise: (exerciseIndex: number, newExerciseId: string) => void;
  removeExercise: (exerciseIndex: number) => void;
  moveExerciseUp: (exerciseIndex: number) => void;
  moveExerciseDown: (exerciseIndex: number) => void;
  /** Drag-and-drop reorder; remaps rest timer indices. */
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
  // Rest timer actions (in store so timer survives addSet/session updates)
  startRest: (exIdx: number, setIdx: number, totalSeconds?: number) => void;
  startManualRest: (seconds: number) => void;
  skipRest: () => void;
  add30SecondsRest: () => void;
  subtract30SecondsRest: () => void;
  resetRest: (totalSeconds?: number) => void;
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

function bumpRestKeysForInsertedSet(
  durations: Record<string, number>,
  exIdx: number
): Record<string, number> {
  const next = { ...durations };
  const keys = Object.keys(durations)
    .map((k) => {
      const [exStr, setStr] = k.split('-');
      return { k, ex: parseInt(exStr, 10), set: parseInt(setStr, 10) };
    })
    .filter((x) => x.ex === exIdx && !Number.isNaN(x.set))
    .sort((a, b) => b.set - a.set);

  for (const { k, set } of keys) {
    next[restKey(exIdx, set + 1)] = durations[k];
    delete next[k];
  }
  return next;
}

function dropRestKeysForRemovedSet(
  durations: Record<string, number>,
  exIdx: number,
  removedSetIdx: number
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(durations)) {
    const [exStr, setStr] = key.split('-');
    const ex = parseInt(exStr, 10);
    const set = parseInt(setStr, 10);
    if (Number.isNaN(ex) || Number.isNaN(set)) continue;
    if (ex !== exIdx) {
      next[key] = seconds;
      continue;
    }
    if (set === removedSetIdx) continue;
    next[restKey(exIdx, set > removedSetIdx ? set - 1 : set)] = seconds;
  }
  return next;
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  session: null,
  hydrated: false,
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

  setExerciseRestBetweenSets: (exerciseIndex, seconds) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    exercises[exerciseIndex] = { ...ex, restBetweenSetsSeconds: seconds };
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
    const completed = { ...sets[setIndex], completed: true };
    sets[setIndex] = completed;
    // Auto-fill next set weight from this set when empty (same warm-up/working kind).
    const nextIdx = setIndex + 1;
    const next = sets[nextIdx];
    if (
      next &&
      next.weightKg == null &&
      completed.weightKg != null &&
      (completed.isWarmUp === true) === (next.isWarmUp === true)
    ) {
      sets[nextIdx] = { ...next, weightKg: completed.weightKg };
    }
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

  addWarmUpSet: (exerciseIndex) => {
    const { session, restAfter, restDurationsBetweenSets } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    exercises[exerciseIndex] = {
      ...ex,
      sets: [{ completed: false, isWarmUp: true }, ...ex.sets],
    };
    const newDurations = bumpRestKeysForInsertedSet(restDurationsBetweenSets, exerciseIndex);
    let newRestAfter = restAfter;
    if (restAfter?.exIdx === exerciseIndex) {
      newRestAfter = { exIdx: exerciseIndex, setIdx: restAfter.setIdx + 1 };
    }
    set({
      session: { ...session, exercises },
      restDurationsBetweenSets: newDurations,
      restAfter: newRestAfter,
    });
  },

  removeSet: (exerciseIndex, setIndex) => {
    const { session, restAfter, restDurationsBetweenSets } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex || ex.sets.length <= 1) return;
    if (setIndex < 0 || setIndex >= ex.sets.length) return;
    const sets = ex.sets.filter((_, i) => i !== setIndex);
    exercises[exerciseIndex] = { ...ex, sets };

    const remappedDurations = dropRestKeysForRemovedSet(
      restDurationsBetweenSets,
      exerciseIndex,
      setIndex
    );
    let nextRestAfter = restAfter;
    let clearRest = false;
    if (restAfter?.exIdx === exerciseIndex) {
      if (restAfter.setIdx === setIndex) {
        clearRest = true;
        nextRestAfter = null;
      } else if (restAfter.setIdx > setIndex) {
        nextRestAfter = { exIdx: exerciseIndex, setIdx: restAfter.setIdx - 1 };
      }
    }

    set({
      session: { ...session, exercises },
      restDurationsBetweenSets: remappedDurations,
      ...(clearRest
        ? { restEndTime: null, restAfter: null }
        : { restAfter: nextRestAfter }),
    });
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

  replaceExercise: (exerciseIndex, newExerciseId) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex || ex.exerciseId === newExerciseId) return;
    exercises[exerciseIndex] = {
      ...ex,
      exerciseId: newExerciseId,
      sets: ex.sets.map((s) => ({ ...s })),
    };
    set({ session: { ...session, exercises } });
  },

  removeExercise: (exerciseIndex) => {
    const { session, restAfter, restDurationsBetweenSets } = get();
    if (!session) return;
    const exercises = session.exercises.filter((_, i) => i !== exerciseIndex);
    const oldToNew = session.exercises.map((_, i) => (i < exerciseIndex ? i : i === exerciseIndex ? -1 : i - 1));
    const remappedDurations = remapRestDurations(restDurationsBetweenSets, oldToNew);
    const clearRest = restAfter?.exIdx === exerciseIndex;
    set({
      session: { ...session, exercises },
      restDurationsBetweenSets: remappedDurations,
      ...(clearRest
        ? { restEndTime: null, restAfter: null }
        : { restAfter: remapRestAfter(restAfter, oldToNew) }),
    });
  },

  moveExerciseUp: (exerciseIndex) => {
    get().reorderExercises(exerciseIndex, exerciseIndex - 1);
  },

  moveExerciseDown: (exerciseIndex) => {
    get().reorderExercises(exerciseIndex, exerciseIndex + 1);
  },

  reorderExercises: (fromIndex, toIndex) => {
    const { session, restAfter, restDurationsBetweenSets } = get();
    if (!session) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= session.exercises.length || toIndex >= session.exercises.length) return;

    const exercises = [...session.exercises];
    const [moved] = exercises.splice(fromIndex, 1);
    exercises.splice(toIndex, 0, moved);

    const oldToNew = session.exercises.map((_, oldIdx) => {
      if (oldIdx === fromIndex) return toIndex;
      if (fromIndex < toIndex) {
        if (oldIdx > fromIndex && oldIdx <= toIndex) return oldIdx - 1;
      } else {
        if (oldIdx >= toIndex && oldIdx < fromIndex) return oldIdx + 1;
      }
      return oldIdx;
    });

    set({
      session: { ...session, exercises },
      restDurationsBetweenSets: remapRestDurations(restDurationsBetweenSets, oldToNew),
      restAfter: remapRestAfter(restAfter, oldToNew),
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

    // Update previous weight/reps per exercise (best completed set by weight, then reps)
    const prev = await getExercisePrevious();
    for (const se of completed.exercises) {
      const best = se.sets
        .filter((s) => s.completed && s.weightKg != null && s.weightKg > 0)
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

    // Keep peer stores in sync so home/history/recovery update without waiting for focus
    await Promise.all([
      useSessionsStore.getState().load(),
      useRecoveryStore.getState().load(),
    ]);

    notifySessionUpsert(completed);
    notifyRecoverySnapshot(merged);
    notifyExercisePreviousSnapshot(prev);
    void syncAfterWorkout();
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
      const taken = Math.max(
        0,
        restTotalSeconds - Math.ceil((restEndTime - Date.now()) / 1000)
      );
      set((s) => ({
        restDurationsBetweenSets: {
          ...s.restDurationsBetweenSets,
          [`${restAfter.exIdx}-${restAfter.setIdx}`]: taken,
        },
      }));
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

  resetRest: (totalSeconds = DEFAULT_REST_SECONDS) => {
    set({
      restTotalSeconds: totalSeconds,
      restEndTime: Date.now() + totalSeconds * 1000,
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

/**
 * The OS can kill the app at any point during a workout — most likely during a long
 * rest while the user is in another app — so the session is mirrored to storage and
 * read back on launch. Without this, reopening from the workout notification lands on
 * an empty home screen with the workout gone.
 */
const PERSIST_DEBOUNCE_MS = 400;

let persistEnabled = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function writeSnapshot() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const { session, restEndTime, restTotalSeconds, restAfter, restDurationsBetweenSets } =
    useActiveWorkoutStore.getState();
  void setActiveWorkout(
    session
      ? { session, restEndTime, restTotalSeconds, restAfter, restDurationsBetweenSets }
      : null
  );
}

useActiveWorkoutStore.subscribe(() => {
  if (!persistEnabled || persistTimer) return;
  // Typing in a weight field fires a set() per keystroke, so coalesce the writes.
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeSnapshot();
  }, PERSIST_DEBOUNCE_MS);
});

// Backgrounding is the last moment we're guaranteed to run before being killed.
AppState.addEventListener('change', (state) => {
  if (persistEnabled && state !== 'active') writeSnapshot();
});

let hydrating: Promise<void> | null = null;

/** Restores an interrupted workout. Safe to call more than once; only the first runs. */
export function hydrateActiveWorkout(): Promise<void> {
  hydrating ??= (async () => {
    try {
      const saved = await getActiveWorkout();
      // A workout started while we were reading (deep link, resume tap) wins.
      if (saved && !useActiveWorkoutStore.getState().session) {
        useActiveWorkoutStore.setState({
          session: saved.session,
          restEndTime: saved.restEndTime != null && saved.restEndTime > Date.now() ? saved.restEndTime : null,
          restTotalSeconds: saved.restTotalSeconds ?? DEFAULT_REST_SECONDS,
          restAfter: saved.restAfter ?? null,
          restDurationsBetweenSets: saved.restDurationsBetweenSets ?? {},
        });
      }
    } finally {
      useActiveWorkoutStore.setState({ hydrated: true });
      persistEnabled = true;
      // Catches a workout started while hydration was still in flight.
      if (useActiveWorkoutStore.getState().session) writeSnapshot();
    }
  })();
  return hydrating;
}
