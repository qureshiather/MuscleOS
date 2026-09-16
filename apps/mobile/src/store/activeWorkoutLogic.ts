import type { SetRecord, SessionExercise, WorkoutSession } from '@muscleos/types';
import type { PersistedActiveWorkout } from '@/storage/localStorage';

/**
 * Pure session-transformation logic for the active workout.
 *
 * These functions hold the set-logging and rest-bookkeeping rules described in
 * docs/features/workout-logging.md. They are deliberately free of Zustand, storage, and
 * React Native so they can be unit-tested; `activeWorkoutStore` is a thin wrapper that calls
 * them and persists the result.
 */

export const DEFAULT_SETS_PER_EXERCISE = 3;
export const DEFAULT_REST_SECONDS = 120;

export interface RestAfter {
  exIdx: number;
  setIdx: number;
}

export function restKey(exIdx: number, setIdx: number): string {
  return `${exIdx}-${setIdx}`;
}

/** A new session with `defaultSets ?? 3` blank sets per exercise. */
export function createEmptySession(
  templateId: string,
  exerciseIds: string[],
  defaultSets?: number,
  now: number = Date.now()
): WorkoutSession {
  const numSets = defaultSets ?? DEFAULT_SETS_PER_EXERCISE;
  const sets = Array.from({ length: numSets }, () => ({ completed: false }));
  return {
    id: 'session_' + now,
    templateId,
    startedAt: new Date(now).toISOString(),
    exercises: exerciseIds.map((exerciseId) => ({
      exerciseId,
      sets: sets.map((s) => ({ ...s })),
    })),
  };
}

/** Remap "exIdx-setIdx" rest duration keys after exercises move; `oldToNew[i] == null` drops key. */
export function remapRestDurations(
  durations: Record<string, number>,
  oldToNew: (number | null | undefined)[]
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(durations)) {
    const [exStr, setStr] = key.split('-');
    const oldEx = parseInt(exStr, 10);
    const setIdx = parseInt(setStr, 10);
    if (Number.isNaN(oldEx) || Number.isNaN(setIdx)) continue;
    const newEx = oldToNew[oldEx];
    if (newEx == null || newEx < 0) continue;
    next[restKey(newEx, setIdx)] = seconds;
  }
  return next;
}

export function remapRestAfter(
  restAfter: RestAfter | null,
  oldToNew: (number | null | undefined)[]
): RestAfter | null {
  if (!restAfter) return null;
  const newEx = oldToNew[restAfter.exIdx];
  if (newEx == null || newEx < 0) return null;
  return { exIdx: newEx, setIdx: restAfter.setIdx };
}

/** Adding a warm-up at position 0 shifts every existing set of that exercise up by one. */
export function bumpRestKeysForInsertedSet(
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

export function dropRestKeysForRemovedSet(
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

/**
 * Index map after removing the exercise at `removedIdx`: the removed slot maps to -1, everything
 * after it shifts down by one.
 */
export function oldToNewForRemove(length: number, removedIdx: number): number[] {
  return Array.from({ length }, (_, i) => (i < removedIdx ? i : i === removedIdx ? -1 : i - 1));
}

/** Index map after moving the exercise at `fromIndex` to `toIndex`. */
export function oldToNewForReorder(length: number, fromIndex: number, toIndex: number): number[] {
  return Array.from({ length }, (_, oldIdx) => {
    if (oldIdx === fromIndex) return toIndex;
    if (fromIndex < toIndex) {
      if (oldIdx > fromIndex && oldIdx <= toIndex) return oldIdx - 1;
    } else if (oldIdx >= toIndex && oldIdx < fromIndex) {
      return oldIdx + 1;
    }
    return oldIdx;
  });
}

/**
 * Complete a set and, when the next set is the same kind (warm-up vs working) and has no weight,
 * copy this set's weight into it. Reps are never carried over on complete. Returns a new array.
 */
export function completeSetInSets(sets: SetRecord[], setIndex: number): SetRecord[] {
  if (!sets[setIndex]) return sets;
  const next = [...sets];
  const completed = { ...next[setIndex], completed: true };
  next[setIndex] = completed;
  const nextIdx = setIndex + 1;
  const following = next[nextIdx];
  if (
    following &&
    following.weightKg == null &&
    completed.weightKg != null &&
    (completed.isWarmUp === true) === (following.isWarmUp === true)
  ) {
    next[nextIdx] = { ...following, weightKg: completed.weightKg };
  }
  return next;
}

/** A new working set that carries the previous last set's weight and reps if present. */
export function buildAddedSet(sets: SetRecord[]): SetRecord {
  const lastSet = sets[sets.length - 1];
  return {
    completed: false,
    ...(lastSet?.weightKg != null && { weightKg: lastSet.weightKg }),
    ...(lastSet?.reps != null && { reps: lastSet.reps }),
  };
}

/**
 * The best completed weighted set: highest weight, then highest reps as a tie-break. Only
 * completed sets with a positive weight qualify. Returns undefined when none do.
 */
export function bestCompletedSet(sets: SetRecord[]): SetRecord | undefined {
  return sets
    .filter((s) => s.completed && s.weightKg != null && s.weightKg > 0)
    .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
}

export interface PreviousSnapshot {
  weightKg: number;
  reps?: number;
}

/** A set can be completed only once it has a positive rep count; weight is optional. */
export function canCompleteSet(set: Pick<SetRecord, 'reps'>): boolean {
  return set.reps != null && set.reps > 0;
}

/** Completing a working set auto-starts rest; warm-ups do not. */
export function shouldStartRestAfterComplete(set: Pick<SetRecord, 'isWarmUp'>): boolean {
  return set.isWarmUp !== true;
}

/**
 * At session start, a set that is completely empty (no weight *and* no reps) is prefilled from the
 * exercise's previous snapshot. Partially filled sets are left alone. Returns the patch to apply,
 * or null when there is nothing to prefill.
 */
export function startPrefillPatch(
  set: Pick<SetRecord, 'weightKg' | 'reps'>,
  previous: PreviousSnapshot | undefined
): { weightKg: number; reps?: number } | null {
  if (!previous) return null;
  if (set.weightKg != null || set.reps != null) return null;
  return { weightKg: previous.weightKg, reps: previous.reps };
}

/** Parsed route params for starting a workout from a deep link / template preview. */
export function parseStartParams(exerciseIds?: string, defaultSets?: string): {
  exerciseIds: string[];
  defaultSets: number | undefined;
} {
  const ids = (exerciseIds ?? '').split(',').filter(Boolean);
  const parsed = defaultSets != null ? parseInt(defaultSets, 10) : NaN;
  const sets = !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined;
  return { exerciseIds: ids, defaultSets: sets };
}

export interface HydratedState {
  session: WorkoutSession;
  restEndTime: number | null;
  restTotalSeconds: number;
  restAfter: RestAfter | null;
  restDurationsBetweenSets: Record<string, number>;
}

/**
 * Normalize a persisted snapshot back into store state on app boot. A rest timer that already
 * expired while the app was dead is dropped (its `restEndTime` is in the past); missing fields
 * fall back to their defaults.
 */
export function normalizeHydratedState(
  saved: PersistedActiveWorkout,
  now: number = Date.now()
): HydratedState {
  return {
    session: saved.session,
    restEndTime: saved.restEndTime != null && saved.restEndTime > now ? saved.restEndTime : null,
    restTotalSeconds: saved.restTotalSeconds ?? DEFAULT_REST_SECONDS,
    restAfter: saved.restAfter ?? null,
    restDurationsBetweenSets: saved.restDurationsBetweenSets ?? {},
  };
}

/**
 * Overlay each exercise's best completed weighted set onto the existing "previous" snapshot map.
 * Exercises with no qualifying set leave their prior snapshot untouched.
 */
export function buildPreviousSnapshot(
  exercises: SessionExercise[],
  existing: Record<string, PreviousSnapshot>
): Record<string, PreviousSnapshot> {
  const prev = { ...existing };
  for (const se of exercises) {
    const best = bestCompletedSet(se.sets);
    if (best) {
      prev[se.exerciseId] = { weightKg: best.weightKg!, reps: best.reps };
    }
  }
  return prev;
}
