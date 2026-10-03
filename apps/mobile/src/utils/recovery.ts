import {
  type Exercise,
  getRecoveryHoursForMuscle,
  getRecoveryUntil,
  MUSCLE_GROUPS,
  type MuscleId,
  muscleLabel,
  type MuscleRecovery,
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

/**
 * Muscles worked in one session, for the post-workout "Good work" diagram: every muscle of each
 * exercise with at least one completed set, resolved the same way as recovery (live lookup, then
 * the bundled catalog with alias resolution). Order follows first appearance.
 */
export function musclesTrainedInSession(
  session: Pick<WorkoutSession, 'exercises'>,
  getExercise?: (id: string) => Exercise | undefined
): MuscleId[] {
  const out = new Set<MuscleId>();
  for (const se of session.exercises) {
    if (!se.sets.some((s) => s.completed)) continue;
    for (const muscleId of musclesForExercise(se.exerciseId, getExercise)) out.add(muscleId);
  }
  return [...out];
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

/** Same records in the same order. Lets a reload skip re-rendering and re-persisting. */
export function sameRecovery(a: MuscleRecovery[], b: MuscleRecovery[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => r.muscleId === b[i].muscleId && r.trainedAt === b[i].trainedAt);
}

/**
 * Records still recovering at `now`: derived `recoveryUntil` strictly after `now`. At the exact
 * expiry instant a muscle is ready and drops out.
 */
export function activeRecoveryAt(items: MuscleRecovery[], now: Date): MuscleRecovery[] {
  const nowIso = now.toISOString();
  return items.filter((r) => getRecoveryUntil(r) > nowIso);
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

/** One recovery-duration bucket: its hours and the muscles in it, in taxonomy order. */
export type RecoveryBucket = { hours: number; muscleIds: MuscleId[] };

/** Every muscle grouped by its recovery hours (`getRecoveryHoursForMuscle`), fastest first. */
export function recoveryBuckets(): RecoveryBucket[] {
  const byHours = new Map<number, MuscleId[]>();
  for (const id of Object.keys(MUSCLE_GROUPS) as MuscleId[]) {
    const hours = getRecoveryHoursForMuscle(id);
    byHours.set(hours, [...(byHours.get(hours) ?? []), id]);
  }
  return [...byHours]
    .sort(([a], [b]) => a - b)
    .map(([hours, muscleIds]) => ({ hours, muscleIds }));
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The "Some recover faster" paragraph in the How recovery works explainer, generated from the
 * duration table so the copy can't drift from the model:
 * `Abs, obliques, … and forearms are ready after 36 hours; … after 48 hours; … after 72 hours.`
 */
export function recoveryBucketsCopy(): string {
  const parts = recoveryBuckets().map(({ hours, muscleIds }, i) => {
    const names = muscleIds.map((id) => muscleLabel(id).toLowerCase());
    if (i === 0) names[0] = muscleLabel(muscleIds[0]);
    return `${listJoin(names)} ${i === 0 ? 'are ready after' : 'after'} ${hours} hours`;
  });
  return `${parts.join('; ')}.`;
}
