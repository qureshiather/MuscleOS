import type { WorkoutSession } from '@muscleos/types';
import { KG_TO_LB, type WeightUnit } from '@/utils/weightUnits';

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

/** Estimated 1RM for display: the user's unit, one decimal, trailing `.0` dropped (`116.7 kg`). */
export function formatE1RM(kg: number, unit: WeightUnit): string {
  const value = unit === 'lb' ? kg * KG_TO_LB : kg;
  return `${Math.round(value * 10) / 10} ${unit}`;
}

/**
 * From completed sessions, build per-exercise PR and 1RM history.
 * Sessions should be newest first (e.g. completedSessions()); on an e1RM tie the set that comes
 * first in that order is the best set.
 *
 * Exercises are keyed by `canonicalId`, so sets logged under a legacy alias merge into the
 * current catalog exercise.
 */
export function buildExercisePRs(
  sessions: WorkoutSession[],
  canonicalId: (exerciseId: string) => string = (id) => id
): ExercisePR[] {
  const byExercise = new Map<string, SetWithDate[]>();

  for (const session of sessions) {
    if (!session.completedAt) continue;
    for (const se of session.exercises) {
      for (const set of se.sets) {
        if (!set.completed || set.weightKg == null || set.weightKg <= 0) continue;
        const reps = set.reps ?? 0;
        if (reps < 1) continue;
        const e1rm = estimatedOneRepMax(set.weightKg, reps);
        const id = canonicalId(se.exerciseId);
        const list = byExercise.get(id) ?? [];
        list.push({
          weightKg: set.weightKg,
          reps,
          estimated1RM: e1rm,
          completedAt: session.completedAt,
        });
        byExercise.set(id, list);
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
