import type { SetRecord, SessionExercise } from '@muscleos/types';

/**
 * Pure view logic for the set-logging table (docs/features/workout-logging.md#set-logging).
 *
 * Working sets are numbered 1, 2, 3…; warm-ups are W1, W2… and are excluded from that count.
 * Exactly one set across the whole workout is "current": the first incomplete set of the first
 * exercise that still has unlogged sets.
 */

/** Index of the first not-completed set, or -1 when every set is done. */
export function firstIncompleteSetIndex(sets: readonly SetRecord[]): number {
  return sets.findIndex((s) => !s.completed);
}

/** Index of the first exercise that still has an incomplete set, or -1 when the workout is done. */
export function activeExerciseIndex(exercises: readonly SessionExercise[]): number {
  return exercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
}

/** 1-based position among warm-up sets up to and including `setIdx`; 0 if the set is a working set. */
export function warmUpNumber(sets: readonly SetRecord[], setIdx: number): number {
  if (sets[setIdx]?.isWarmUp !== true) return 0;
  return sets.slice(0, setIdx + 1).filter((s) => s.isWarmUp).length;
}

/** 1-based position among working sets up to and including `setIdx`; 0 if the set is a warm-up. */
export function workingSetNumber(sets: readonly SetRecord[], setIdx: number): number {
  if (sets[setIdx]?.isWarmUp === true) return 0;
  return sets.slice(0, setIdx + 1).filter((s) => s.isWarmUp !== true).length;
}

/** Row label: `W1`, `W2`… for warm-ups, `1`, `2`… for working sets. */
export function setLabel(sets: readonly SetRecord[], setIdx: number): string {
  return sets[setIdx]?.isWarmUp === true
    ? `W${warmUpNumber(sets, setIdx)}`
    : String(workingSetNumber(sets, setIdx));
}

/**
 * Whether the set at (exIdx, setIdx) is *the* current set — the single highlighted set for the
 * whole workout. There is never more than one.
 */
export function isCurrentSet(
  exercises: readonly SessionExercise[],
  exIdx: number,
  setIdx: number
): boolean {
  if (activeExerciseIndex(exercises) !== exIdx) return false;
  const sets = exercises[exIdx]?.sets ?? [];
  return firstIncompleteSetIndex(sets) === setIdx && !sets[setIdx]?.completed;
}
