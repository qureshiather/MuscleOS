import type { Exercise, MuscleId, MuscleRecovery, WorkoutSession } from '@muscleos/types';
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
