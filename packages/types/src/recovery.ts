import type { MuscleId } from './muscles';

/** Default for muscles not in the mapping (e.g. large groups). */
export const DEFAULT_RECOVERY_HOURS = 72;

/**
 * Recovery hours per muscle group:
 * - Small (24–48h): abs, biceps, triceps, forearms
 * - Medium (48h): shoulders
 * - Large (48–72+h): back, chest, quads, hamstrings (and glutes, lower_back); calves/obliques use medium/default
 */
export const RECOVERY_HOURS_BY_MUSCLE: Record<MuscleId, number> = {
  // Small muscle groups (36h)
  abs: 36,
  obliques: 36,
  biceps: 36,
  triceps: 36,
  forearms: 36,
  // Medium (48h) – shoulders, calves
  front_delts: 48,
  side_delts: 48,
  rear_delts: 48,
  calves: 48,
  // Large (72h) – back, chest, quads, hamstrings, glutes, lower_back
  chest: 72,
  traps: 72,
  lats: 72,
  rhomboids: 72,
  lower_back: 72,
  quads: 72,
  hamstrings: 72,
  glutes: 72,
};

export function getRecoveryHoursForMuscle(muscleId: MuscleId): number {
  return RECOVERY_HOURS_BY_MUSCLE[muscleId] ?? DEFAULT_RECOVERY_HOURS;
}

export interface MuscleRecovery {
  muscleId: MuscleId;
  trainedAt: string; // ISO
}

/** Derive recoveryUntil at runtime from trainedAt and muscle-specific hours. */
export function getRecoveryUntil(r: MuscleRecovery): string {
  const hours = getRecoveryHoursForMuscle(r.muscleId);
  const until = new Date(new Date(r.trainedAt).getTime() + hours * 60 * 60 * 1000);
  return until.toISOString();
}
