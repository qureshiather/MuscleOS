import { AppState } from 'react-native';
import { create } from 'zustand';
import type { WorkoutSession, SessionExercise, SetRecord, TemplateExercise } from '@muscleos/types';
import {
  getSessions,
  setSessions,
  getExercisePrevious,
  setExercisePrevious,
  getActiveWorkout,
  setActiveWorkout,
} from '@/storage/localStorage';
import { setRecovery } from '@/storage/localStorage';
import { recoveryFromSessions } from '@/utils/recovery';
import { useExercisesStore } from '@/store/exercisesStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import {
  notifySessionUpsert,
  notifyExercisePreviousSnapshot,
  syncAfterWorkout,
} from '@/sync';
import {
  DEFAULT_REST_SECONDS,
  adjustRunningRest,
  buildAddedSet,
  canCompleteSet,
  storedRestSeconds,
  buildReplacedExercise,
  bumpRestKeysForInsertedSet,
  buildPreviousSnapshot,
  completeSession,
  completeSetInSets,
  createEmptySession,
  createPrefillingSets,
  dropRestKeysForExercise,
  dropRestKeysForRemovedSet,
  normalizeHydratedState,
  oldToNewForRemove,
  prefillSession,
  resolveRestEnd,
  restDurationAfterComplete,
  restTakenSeconds,
  sessionHasExercise,
  oldToNewForReorder,
  remapRestAfter,
  remapRestDurations,
  resolveStaleWorkout,
  type PreviousSnapshot,
  type RestAfter,
  type RestEndResolution,
} from '@/store/activeWorkoutLogic';

export { DEFAULT_REST_SECONDS } from '@/store/activeWorkoutLogic';
export type { PreviousSnapshot, RestAfter, RestEndResolution } from '@/store/activeWorkoutLogic';

/** What a Done tap did: completed the set, un-completed it, or nothing (no reps yet). */
export type SetToggleResult = 'completed' | 'uncompleted' | null;

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
  /** Epoch ms of the last change to the session; drives the stale-workout auto-close. */
  lastActivityAt: number | null;
  /**
   * Starts a session (no-op while one exists), then loads the per-exercise "previous" snapshots
   * and prefills empty working sets once. Resolves when the prefill has been applied.
   */
  startWorkout: (templateId: string, plan: readonly TemplateExercise[]) => Promise<void>;
  setSetRecord: (exerciseIndex: number, setIndex: number, record: Partial<SetRecord>) => void;
  /** Applies to all rests for this exercise (after each set, including the last). */
  setExerciseRestBetweenSets: (exerciseIndex: number, seconds: number) => void;
  setExerciseWarmUpRest: (exerciseIndex: number, seconds: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  /**
   * The set row's Done control. An incomplete set with reps > 0 is completed and its rest
   * starts (see `restDurationAfterComplete`); a completed set is un-completed, cancelling a
   * countdown running for it. Returns what happened so the screen can play the sound.
   */
  toggleSetComplete: (exerciseIndex: number, setIndex: number) => SetToggleResult;
  addSet: (exerciseIndex: number) => void;
  /** Inserts a warm-up set at the start of the exercise. */
  addWarmUpSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  /** Appends an exercise; a no-op when it's already in the workout. */
  addExercise: (exerciseId: string, previous?: PreviousSnapshot) => void;
  /**
   * Swap the exercise at index; sets reset and prefill from the new exercise's previous snapshot.
   * A no-op when the new exercise is already in the workout (including the same slot).
   */
  replaceExercise: (
    exerciseIndex: number,
    newExerciseId: string,
    previous?: PreviousSnapshot
  ) => void;
  removeExercise: (exerciseIndex: number) => void;
  moveExerciseUp: (exerciseIndex: number) => void;
  moveExerciseDown: (exerciseIndex: number) => void;
  /** Drag-and-drop reorder; remaps rest timer indices. */
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  /**
   * `completedAt` defaults to now; the stale-workout close passes the last activity time.
   * `templateId` attributes the session to a template just saved from it ("Save as template").
   */
  finishWorkout: (completedAt?: string, templateId?: string) => Promise<void>;
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
  /**
   * Once the countdown has reached zero: record its full duration against the set it followed and
   * clear the timer. Returns null (and changes nothing) while it is still running.
   */
  endRestIfDue: (now?: number) => RestEndResolution | null;
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  session: null,
  hydrated: false,
  restEndTime: null,
  restTotalSeconds: DEFAULT_REST_SECONDS,
  restAfter: null,
  restDurationsBetweenSets: {},
  lastActivityAt: null,

  startWorkout: async (templateId, plan) => {
    if (get().session) return; // Only one workout at a time
    const session = createEmptySession(templateId, plan);
    set({ session, lastActivityAt: Date.now() });
    // Prefill exactly once, here — not on every screen mount, which refilled sets the user had
    // cleared. Applied to the live session so anything typed meanwhile is kept.
    const previous = await getExercisePrevious();
    const current = get().session;
    if (!current || current.id !== session.id) return;
    const prefilled = prefillSession(current, previous);
    if (prefilled !== current) set({ session: prefilled });
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
    exercises[exerciseIndex] = {
      ...ex,
      restBetweenSetsSeconds: storedRestSeconds(seconds),
    };
    set({ session: { ...session, exercises } });
  },

  setExerciseWarmUpRest: (exerciseIndex, seconds) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    exercises[exerciseIndex] = {
      ...ex,
      warmUpRestSeconds: storedRestSeconds(seconds),
    };
    set({ session: { ...session, exercises } });
  },

  completeSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex || !ex.sets[setIndex]) return;
    exercises[exerciseIndex] = { ...ex, sets: completeSetInSets(ex.sets, setIndex) };
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

  toggleSetComplete: (exerciseIndex, setIndex) => {
    const { session, restAfter } = get();
    const ex = session?.exercises[exerciseIndex];
    const target = ex?.sets[setIndex];
    if (!ex || !target) return null;
    if (target.completed) {
      get().uncompleteSet(exerciseIndex, setIndex);
      if (restAfter?.exIdx === exerciseIndex && restAfter.setIdx === setIndex) {
        get().clearRestTimer();
      }
      return 'uncompleted';
    }
    if (!canCompleteSet(target)) return null;
    get().completeSet(exerciseIndex, setIndex);
    const restSeconds = restDurationAfterComplete(target, ex);
    if (restSeconds != null) get().startRest(exerciseIndex, setIndex, restSeconds);
    return 'completed';
  },

  addSet: (exerciseIndex) => {
    const { session } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    exercises[exerciseIndex] = {
      ...ex,
      sets: [...ex.sets, buildAddedSet(ex.sets)],
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

  addExercise: (exerciseId, previous) => {
    const { session } = get();
    if (!session || sessionHasExercise(session, exerciseId)) return;
    const newEx: SessionExercise = {
      exerciseId,
      sets: createPrefillingSets(previous),
    };
    set({
      session: {
        ...session,
        exercises: [...session.exercises, newEx],
      },
    });
  },

  replaceExercise: (exerciseIndex, newExerciseId, previous) => {
    const { session, restAfter, restDurationsBetweenSets } = get();
    if (!session) return;
    const exercises = [...session.exercises];
    const ex = exercises[exerciseIndex];
    if (!ex || sessionHasExercise(session, newExerciseId)) return;
    exercises[exerciseIndex] = buildReplacedExercise(ex, newExerciseId, previous);
    const clearRest = restAfter?.exIdx === exerciseIndex;
    set({
      session: { ...session, exercises },
      restDurationsBetweenSets: dropRestKeysForExercise(restDurationsBetweenSets, exerciseIndex),
      ...(clearRest ? { restEndTime: null, restAfter: null } : {}),
    });
  },

  removeExercise: (exerciseIndex) => {
    const { session, restAfter, restDurationsBetweenSets } = get();
    if (!session) return;
    const exercises = session.exercises.filter((_, i) => i !== exerciseIndex);
    const oldToNew = oldToNewForRemove(session.exercises.length, exerciseIndex);
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

    const oldToNew = oldToNewForReorder(session.exercises.length, fromIndex, toIndex);

    set({
      session: { ...session, exercises },
      restDurationsBetweenSets: remapRestDurations(restDurationsBetweenSets, oldToNew),
      restAfter: remapRestAfter(restAfter, oldToNew),
    });
  },

  finishWorkout: async (completedAt = new Date().toISOString(), templateId) => {
    const { session } = get();
    if (!session) return;
    const completed = completeSession(session, completedAt, templateId);
    const sessions = await getSessions();
    const allSessions = [...sessions, completed];
    await setSessions(allSessions);

    // Update previous weight/reps per exercise (best completed set by weight, then reps)
    const prev = buildPreviousSnapshot(completed.exercises, await getExercisePrevious());
    await setExercisePrevious(prev);

    const merged = recoveryFromSessions(allSessions, (id) =>
      useExercisesStore.getState().getExercise(id)
    );
    await setRecovery(merged);

    set({
      session: null,
      restEndTime: null,
      restAfter: null,
      restDurationsBetweenSets: {},
      lastActivityAt: null,
    });

    // Keep peer stores in sync so home/history/recovery update without waiting for focus
    await Promise.all([
      useSessionsStore.getState().load(),
      useRecoveryStore.getState().load(),
    ]);

    notifySessionUpsert(completed);
    notifyExercisePreviousSnapshot(prev);
    void syncAfterWorkout();
  },

  discardWorkout: () =>
    set({
      session: null,
      restEndTime: null,
      restAfter: null,
      restDurationsBetweenSets: {},
      lastActivityAt: null,
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
      const taken = restTakenSeconds(restTotalSeconds, restEndTime, Date.now());
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
    const { restEndTime, restTotalSeconds } = get();
    if (restEndTime === null) return;
    const next = adjustRunningRest({ endTime: restEndTime, total: restTotalSeconds }, 1, Date.now());
    set({ restTotalSeconds: next.total, restEndTime: next.endTime });
  },

  subtract30SecondsRest: () => {
    const { restEndTime, restTotalSeconds } = get();
    if (restEndTime === null) return;
    const next = adjustRunningRest({ endTime: restEndTime, total: restTotalSeconds }, -1, Date.now());
    set({ restTotalSeconds: next.total, restEndTime: next.endTime });
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

  endRestIfDue: (now = Date.now()) => {
    const { restEndTime, restAfter, restTotalSeconds } = get();
    const ended = resolveRestEnd({ restEndTime, restAfter, total: restTotalSeconds }, now);
    if (!ended) return null;
    if (ended.record) get().recordRestDuration(ended.record.exIdx, ended.record.setIdx, ended.record.seconds);
    get().clearRestTimer();
    return ended;
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
  const {
    session,
    restEndTime,
    restTotalSeconds,
    restAfter,
    restDurationsBetweenSets,
    lastActivityAt,
  } = useActiveWorkoutStore.getState();
  void setActiveWorkout(
    session
      ? {
          session,
          restEndTime,
          restTotalSeconds,
          restAfter,
          restDurationsBetweenSets,
          lastActivityAt: lastActivityAt ?? undefined,
        }
      : null
  );
}

// Every edit to a running session counts as activity. Starting and hydrating set
// `lastActivityAt` themselves (prev.session is null there), and rest-timer ticks don't touch
// the session, so they don't keep a forgotten workout alive.
useActiveWorkoutStore.subscribe((state, prev) => {
  if (state.session && prev.session && state.session !== prev.session) {
    useActiveWorkoutStore.setState({ lastActivityAt: Date.now() });
  }
});

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
  if (state === 'active') void closeStaleWorkout();
});

let closingStale: Promise<void> | null = null;

/**
 * Silently closes a workout the user walked away from (see `resolveStaleWorkout`). Runs after
 * hydration and whenever the app returns to the foreground. Guarded so a foreground event during
 * the async finish can't save the session twice.
 */
export function closeStaleWorkout(): Promise<void> {
  // Cleared via .finally on the stored promise, not inside the async body: when there's nothing to
  // close the body settles synchronously, and clearing there would run before this assignment.
  closingStale ??= (async () => {
    const store = useActiveWorkoutStore.getState();
    if (!store.hydrated || !store.session || store.lastActivityAt == null) return;
    const resolution = resolveStaleWorkout(store.session, store.lastActivityAt);
    if (resolution?.kind === 'finish') await store.finishWorkout(resolution.completedAt);
    else if (resolution?.kind === 'discard') store.discardWorkout();
  })().finally(() => {
    closingStale = null;
  });
  return closingStale;
}

let hydrating: Promise<void> | null = null;

/** Restores an interrupted workout. Safe to call more than once; only the first runs. */
export function hydrateActiveWorkout(): Promise<void> {
  hydrating ??= (async () => {
    try {
      const saved = await getActiveWorkout();
      // A workout started while we were reading (deep link, resume tap) wins.
      if (saved && !useActiveWorkoutStore.getState().session) {
        useActiveWorkoutStore.setState(normalizeHydratedState(saved));
      }
    } finally {
      useActiveWorkoutStore.setState({ hydrated: true });
      persistEnabled = true;
      // Catches a workout started while hydration was still in flight.
      if (useActiveWorkoutStore.getState().session) writeSnapshot();
    }
    await closeStaleWorkout();
  })();
  return hydrating;
}
