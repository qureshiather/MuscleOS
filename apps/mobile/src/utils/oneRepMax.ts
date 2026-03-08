import type { WorkoutSession, SetRecord } from '@muscleos/types';

/**
 * Epley formula: 1RM ≈ weight × (1 + reps/30)
 * For 1 rep returns weight; for 0 reps returns 0.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface SetWithDate {
  weightKg: number;
  reps: number;
  estimated1RM: number;
  completedAt: string;
}

export interface ExercisePR {
  exerciseId: string;
  /** Best estimated 1RM from any set (all time) */
  bestEstimated1RM: number;
  /** The set that produced the best 1RM */
  bestSet: { weightKg: number; reps: number } | null;
  /** All sets with 1RM, newest first (for progress graph) */
  history: SetWithDate[];
}

/**
 * From completed sessions, build per-exercise PR and 1RM history.
 * Sessions should be newest first (e.g. completedSessions()).
 */
export function buildExercisePRs(sessions: WorkoutSession[]): ExercisePR[] {
  const byExercise = new Map<string, SetWithDate[]>();

  for (const session of sessions) {
    if (!session.completedAt) continue;
    for (const se of session.exercises) {
      for (const set of se.sets) {
        if (!set.completed || set.weightKg == null || set.weightKg <= 0) continue;
        const reps = set.reps ?? 0;
        if (reps < 1) continue;
        const e1rm = estimatedOneRepMax(set.weightKg, reps);
        const list = byExercise.get(se.exerciseId) ?? [];
        list.push({
          weightKg: set.weightKg,
          reps,
          estimated1RM: e1rm,
          completedAt: session.completedAt,
        });
        byExercise.set(se.exerciseId, list);
      }
    }
  }

  const result: ExercisePR[] = [];
  for (const [exerciseId, history] of byExercise) {
    const sorted = [...history].sort((a, b) => b.estimated1RM - a.estimated1RM);
    const best = sorted[0];
    const historyNewestFirst = [...history].sort(
      (a, b) => b.completedAt.localeCompare(a.completedAt)
    );
    result.push({
      exerciseId,
      bestEstimated1RM: best.estimated1RM,
      bestSet: best ? { weightKg: best.weightKg, reps: best.reps } : null,
      history: historyNewestFirst,
    });
  }

  return result.sort((a, b) => b.bestEstimated1RM - a.bestEstimated1RM);
}
