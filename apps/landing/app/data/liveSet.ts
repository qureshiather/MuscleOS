import { getRecoveryHoursForMuscle, muscleLabel, type MuscleId } from '@muscleos/types';

import { getExercise } from './exercises';

/** The hero's playable set table: one exercise, last time's numbers, three working sets. */
export type LiveSet = { kg: number; reps: number; done: boolean };

export const LIVE_EXERCISE_ID = 'bench-press';
export const LIVE_PREVIOUS = { kg: 80, reps: 8 } as const;
export const LIVE_REST_SECONDS = 120;
export const LIVE_START: readonly LiveSet[] = [
  { kg: 82.5, reps: 8, done: false },
  { kg: 82.5, reps: 8, done: false },
  { kg: 82.5, reps: 8, done: false },
];

/** Index of the first set still to do, or -1 once every set is done. */
export function nextSetIndex(sets: readonly LiveSet[]): number {
  return sets.findIndex((s) => !s.done);
}

/** Heavier than last time, or the same weight for more reps. */
export function beatsPrevious(set: Pick<LiveSet, 'kg' | 'reps'>, previous: { kg: number; reps: number }): boolean {
  return set.kg > previous.kg || (set.kg === previous.kg && set.reps > previous.reps);
}

/** Total weight moved by completed sets, in kg. */
export function completedVolume(sets: readonly LiveSet[]): number {
  return sets.reduce((sum, s) => (s.done ? sum + s.kg * s.reps : sum), 0);
}

/** `125` → `2:05`. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Trims a typed value to a usable number, keeping the last good one when the field is cleared. */
export function parseEntry(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 999) : fallback;
}

/** The muscles the exercise trains, with the app's recovery window for each, longest first. */
export function recoveryAfter(exerciseId: string): { id: MuscleId; label: string; hours: number }[] {
  const muscles = (getExercise(exerciseId)?.muscles ?? []) as MuscleId[];
  return muscles
    .map((id) => ({ id, label: muscleLabel(id), hours: getRecoveryHoursForMuscle(id) }))
    .sort((a, b) => b.hours - a.hours);
}
