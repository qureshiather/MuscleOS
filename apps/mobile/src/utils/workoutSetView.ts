import type { SetRecord, SessionExercise } from '@muscleos/types';
import { DEFAULT_REST_SECONDS, type PreviousSnapshot, type RestAfter } from '@/store/activeWorkoutLogic';
import { kgToDisplay, type WeightUnit } from '@/utils/weightUnits';

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

/** completed → green; current → the one highlighted set; future → every other incomplete set (muted). */
export type SetRowStatus = 'completed' | 'current' | 'future';

export interface SetRowView {
  label: string;
  isWarmUp: boolean;
  status: SetRowStatus;
  /** The rest that follows this set: the exercise's warm-up or work-set preset. */
  restPresetSeconds: number;
  /** A countdown is running for the rest after this set. */
  restActive: boolean;
  /** A rest row sits after this set: its preset is > 0, or its countdown is running. */
  showRestAfter: boolean;
  /**
   * The rest row sits between two completed sets (and isn't counting down), so it carries their
   * green tint and bar — a run of completed sets reads as one unbroken column.
   */
  restJoinsCompleted: boolean;
}

/**
 * Everything the set table needs to style one row. "Future" is decided against the single
 * global current set, so incomplete sets in later exercises render muted too.
 */
export function setRowView(
  exercises: readonly SessionExercise[],
  exIdx: number,
  setIdx: number,
  rest: { restAfter: RestAfter | null; restSecondsLeft: number | null }
): SetRowView {
  const ex = exercises[exIdx];
  const sets = ex?.sets ?? [];
  const set = sets[setIdx];
  const isWarmUp = set?.isWarmUp === true;
  const status: SetRowStatus = set?.completed
    ? 'completed'
    : isCurrentSet(exercises, exIdx, setIdx)
      ? 'current'
      : 'future';
  const restPresetSeconds = isWarmUp
    ? (ex?.warmUpRestSeconds ?? 0)
    : (ex?.restBetweenSetsSeconds ?? DEFAULT_REST_SECONDS);
  const restActive =
    rest.restAfter?.exIdx === exIdx &&
    rest.restAfter.setIdx === setIdx &&
    rest.restSecondsLeft != null &&
    rest.restSecondsLeft > 0;
  return {
    label: setLabel(sets, setIdx),
    isWarmUp,
    status,
    restPresetSeconds,
    restActive,
    showRestAfter: restActive || restPresetSeconds > 0,
    restJoinsCompleted: status === 'completed' && sets[setIdx + 1]?.completed === true && !restActive,
  };
}

/**
 * The PREVIOUS column, in the user's unit: `"60 × 5"`, or `"60 kg"` without reps, or `—`. The unit
 * is left off when there are reps — the KG / LB column header sits right beside it, and the narrow
 * column can't fit `56.25 kg × 8`.
 */
export function previousLabel(prev: PreviousSnapshot | undefined, unit: WeightUnit): string {
  if (!prev) return '—';
  const weight = kgToDisplay(prev.weightKg, unit);
  return prev.reps != null ? `${weight} × ${prev.reps}` : `${weight} ${unit}`;
}
