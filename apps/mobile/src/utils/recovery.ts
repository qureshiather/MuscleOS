import {
  type Exercise,
  getRecoveryUntil,
  type MuscleId,
  type MuscleRecovery,
  type RecoveryHoursOptions,
  type WorkoutSession,
} from '@muscleos/types';
import { CATALOG_SEED } from '@/data/catalogSeed';
import { buildExerciseAliasMap } from '@/utils/exerciseSearch';

let seedAliasMap: Map<string, string> | null = null;

function musclesFromSeed(exerciseId: string): MuscleId[] {
  seedAliasMap ??= buildExerciseAliasMap(CATALOG_SEED);
  const resolved = seedAliasMap.get(exerciseId) ?? exerciseId;
  return CATALOG_SEED.find((e) => e.id === resolved)?.muscles ?? [];
}

function musclesForExercise(
  exerciseId: string,
  getExercise?: (id: string) => Exercise | undefined
): MuscleId[] {
  const fromLookup = getExercise?.(exerciseId)?.muscles;
  if (fromLookup && fromLookup.length > 0) return fromLookup;
  return musclesFromSeed(exerciseId);
}

/** Latest trainedAt per muscle from completed sets. Uses completedAt, not startedAt. */
export function recoveryFromSessions(
  sessions: WorkoutSession[],
  getExercise?: (id: string) => Exercise | undefined
): MuscleRecovery[] {
  const latestByMuscle = new Map<MuscleId, string>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    const trainedAt = session.completedAt;
    for (const se of session.exercises) {
      if (!se.sets.some((s) => s.completed)) continue;
      for (const muscleId of musclesForExercise(se.exerciseId, getExercise)) {
        const prev = latestByMuscle.get(muscleId);
        if (!prev || trainedAt > prev) latestByMuscle.set(muscleId, trainedAt);
      }
    }
  }
  return Array.from(latestByMuscle.entries()).map(([muscleId, trainedAt]) => ({
    muscleId,
    trainedAt,
  }));
}

/**
 * Records still recovering at `now`: derived `recoveryUntil` strictly after `now`. At the exact
 * expiry instant a muscle is ready and drops out.
 */
export function activeRecoveryAt(
  items: MuscleRecovery[],
  now: Date,
  options?: RecoveryHoursOptions
): MuscleRecovery[] {
  const nowIso = now.toISOString();
  return items.filter((r) => getRecoveryUntil(r, options) > nowIso);
}

/**
 * "Just trained" on the Recovery tab: muscles whose `trainedAt` equals the latest `trainedAt`
 * among active records — effectively the most recent session. Ties all count.
 */
export function justTrainedMuscleIds(active: MuscleRecovery[]): MuscleId[] {
  if (active.length === 0) return [];
  const latest = active.reduce((max, r) => (r.trainedAt > max ? r.trainedAt : max), active[0].trainedAt);
  return [...new Set(active.filter((r) => r.trainedAt === latest).map((r) => r.muscleId))];
}

/** Window for "recently worked" muscles that steer Suggested toward variety. */
export const RECENTLY_WORKED_WINDOW_DAYS = 7;

/**
 * Muscles trained in completed sessions within the last 7 days. Like recovery, an exercise only
 * counts when at least one of its sets is completed.
 */
export function recentlyWorkedMuscleIds(
  sessions: WorkoutSession[],
  nowMs: number,
  getExercise: (id: string) => Exercise | undefined
): Set<MuscleId> {
  const windowMs = RECENTLY_WORKED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const out = new Set<MuscleId>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    if (nowMs - new Date(session.completedAt).getTime() > windowMs) continue;
    for (const se of session.exercises) {
      if (!se.sets.some((s) => s.completed)) continue;
      for (const muscleId of getExercise(se.exerciseId)?.muscles ?? []) out.add(muscleId);
    }
  }
  return out;
}
